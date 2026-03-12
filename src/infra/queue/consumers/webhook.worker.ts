import { type Job, Worker } from "bullmq";
import type { Redis } from "ioredis";

import type { WebhookPayloadProps } from "../../../domain/ingestion/enterprise/entities/webhook-payload.js";
import { env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { QUEUE_NAMES } from "../queues.js";

export interface WebhookWorkerDeps {
    connection: Redis;
    logger: Logger;
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
        });

        this.worker.on("error", (err) => {
            this.deps.logger.error({ error: err.message }, "Webhook worker error");
        });

        this.deps.logger.info("Webhook worker started");
    }

    private async processJob(job: Job<WebhookPayloadProps>): Promise<void> {
        const { id, source, headers } = job.data;

        this.deps.logger.debug({ jobId: job.id, webhookId: id, source }, "Processing webhook");

        // =====================================================
        // IMPLEMENTATION HOOK: Add your business logic here
        // =====================================================
        // Examples:
        // - Validate payload structure based on source
        // - Transform data to internal format
        // - Store in database
        // - Trigger domain events
        // - Call downstream services
        //
        // const paymentGateway = this.deps.paymentService;
        // await paymentGateway.processWebhook(source, body);
        // =====================================================

        // Simulate processing time (remove in production)
        await this.simulateProcessing();

        this.deps.logger.info(
            { webhookId: id, source, headersCount: Object.keys(headers).length },
            "Webhook processed successfully",
        );
    }

    private async simulateProcessing(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.deps.logger.info("Webhook worker stopped");
        }
    }
}
