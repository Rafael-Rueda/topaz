import { type Job, Worker } from "bullmq";
import type { Redis } from "ioredis";

import type { IDeliveryRepository } from "../../../domain/ingestion/application/interfaces/delivery-repository.interface.js";
import type { IEventRepository } from "../../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { ApplyTransformUseCase } from "../../../domain/ingestion/application/use-cases/apply-transform.use-case.js";
import type { ExecuteDeliveryUseCase } from "../../../domain/ingestion/application/use-cases/execute-delivery.use-case.js";
import type { ResolveRoutesUseCase } from "../../../domain/ingestion/application/use-cases/resolve-routes.use-case.js";
import type { WebhookPayloadProps } from "../../../domain/ingestion/enterprise/entities/webhook-payload.js";
import { env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { QUEUE_NAMES } from "../queues.js";

export interface WebhookWorkerDeps {
    connection: Redis;
    logger: Logger;
    eventRepository: IEventRepository;
    deliveryRepository: IDeliveryRepository;
    resolveRoutesUseCase: ResolveRoutesUseCase;
    executeDeliveryUseCase: ExecuteDeliveryUseCase;
    applyTransformUseCase: ApplyTransformUseCase;
}

export class WebhookWorker {
    private worker: Worker | null = null;

    constructor(private readonly deps: WebhookWorkerDeps) {}

    start(): void {
        this.worker = new Worker<WebhookPayloadProps>(
            QUEUE_NAMES.WEBHOOK_INGEST,
            async (job: Job<WebhookPayloadProps>) => {
                return this.processJob(job);
            },
            {
                connection: this.deps.connection,
                prefix: env.QUEUE_PREFIX,
                concurrency: 10,
                limiter: {
                    max: 100,
                    duration: 1000,
                },
            },
        );

        this.worker.on("completed", (job) => {
            this.deps.logger.info({ jobId: job.id, source: job.data.source }, "Webhook job completed");
        });

        this.worker.on("failed", (job, err) => {
            this.deps.logger.error({ jobId: job?.id, error: err.message }, "Webhook job failed");
            this.handleJobFailed(job, err);
        });

        this.worker.on("error", (err) => {
            this.deps.logger.error({ error: err.message }, "Webhook worker error");
        });

        this.deps.logger.info("Webhook worker started");
    }

    private async processJob(job: Job<WebhookPayloadProps>): Promise<void> {
        const { id, source, eventType, headers, body } = job.data;

        this.deps.logger.debug({ jobId: job.id, webhookId: id, source }, "Processing webhook");

        // Mark as PROCESSING in Postgres
        await this.deps.eventRepository.updateStatus(id, "PROCESSING", {
            attempts: job.attemptsMade + 1,
        });

        // TESTING: Simulate failure for events with _testFail flag in payload
        if (
            body != null &&
            typeof body === "object" &&
            "_testFail" in body &&
            (body as Record<string, unknown>)._testFail === true
        ) {
            throw new Error("Simulated processing failure for testing");
        }

        // Resolve routes for this event (Fan-out)
        const routes = await this.deps.resolveRoutesUseCase.execute(source, eventType ?? "*");

        if (routes.length === 0) {
            this.deps.logger.warn({ webhookId: id, source, eventType }, "No routes found for event");
            // Mark as delivered since there's nowhere to send it
            await this.deps.eventRepository.updateStatus(id, "DELIVERED", {
                processedAt: new Date(),
            });
            return;
        }

        this.deps.logger.debug({ webhookId: id, source, routeCount: routes.length }, "Resolved routes for event");

        // Apply transform to payload before delivery
        const transformedPayload = await this.deps.applyTransformUseCase.execute(
            { id, source, eventType: eventType ?? "*", timestamp: new Date() },
            body,
        );

        // Execute deliveries to all routes (Fan-out)
        const deliveryResults = await Promise.all(
            routes.map(async (route) => {
                return this.deps.executeDeliveryUseCase.execute(id, route, transformedPayload);
            }),
        );

        // Check if all deliveries succeeded
        const allSucceeded = deliveryResults.every((result) => result.success);
        const anyFailed = deliveryResults.some((result) => !result.success);

        if (anyFailed) {
            const failedCount = deliveryResults.filter((r) => !r.success).length;
            throw new Error(`${failedCount} of ${routes.length} deliveries failed`);
        }

        // Mark as DELIVERED only if all deliveries succeeded
        if (allSucceeded) {
            await this.deps.eventRepository.updateStatus(id, "DELIVERED", {
                processedAt: new Date(),
            });
        }

        this.deps.logger.info(
            {
                webhookId: id,
                source,
                routeCount: routes.length,
                headersCount: Object.keys(headers).length,
            },
            "Webhook processed successfully",
        );
    }

    private async handleJobFailed(job: Job<WebhookPayloadProps> | undefined, err: Error): Promise<void> {
        if (!job) return;

        const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 3);
        const status = isLastAttempt ? "DEAD" : "FAILED";

        try {
            await this.deps.eventRepository.updateStatus(job.data.id, status, {
                lastError: err.message,
                failedAt: new Date(),
                attempts: job.attemptsMade,
            });
        } catch (updateError) {
            this.deps.logger.error(
                { error: (updateError as Error).message, jobId: job.id },
                "Failed to update event status after job failure",
            );
        }
    }

    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.deps.logger.info("Webhook worker stopped");
        }
    }
}
