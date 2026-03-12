import type { IEventRepository } from "../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { IWebhookQueueProducer } from "../../domain/ingestion/application/interfaces/queue-producer.interface.js";
import type { Logger } from "../config/logger.js";

export interface RecoveryJobDeps {
    eventRepository: IEventRepository;
    webhookQueueProducer: IWebhookQueueProducer;
    logger: Logger;
}

/**
 * Recovery Job — re-enqueues events stuck with RECEIVED or QUEUED status.
 *
 * This happens when:
 * - Postgres saved but Redis was down
 * - The process crashed between INSERT and enqueue
 * - Job was lost from Redis but status remained QUEUED
 *
 * Runs every 30s via BullMQ repeatable job.
 */
export class RecoveryJob {
    constructor(private readonly deps: RecoveryJobDeps) {}

    async execute(): Promise<void> {
        await this.recoverReceivedEvents();
        await this.recoverQueuedEvents();
    }

    private async recoverReceivedEvents(): Promise<void> {
        const STUCK_THRESHOLD_MS = 60_000; // events with RECEIVED status older than 1 minute
        const BATCH_SIZE = 100;

        const stuckEvents = await this.deps.eventRepository.findStuckReceived(STUCK_THRESHOLD_MS, BATCH_SIZE);

        if (stuckEvents.length === 0) return;

        this.deps.logger.info({ count: stuckEvents.length }, "Recovery: found stuck RECEIVED events, re-enqueuing");

        const successIds: string[] = [];

        for (const event of stuckEvents) {
            try {
                await this.deps.webhookQueueProducer.enqueue({
                    id: event.id,
                    source: event.source,
                    timestamp: event.createdAt,
                    headers: event.headers as Record<string, string>,
                    body: event.payload,
                    signature: event.signature ?? undefined,
                });
                successIds.push(event.id);
            } catch (err) {
                this.deps.logger.error(
                    { error: (err as Error).message, eventId: event.id },
                    "Recovery: failed to re-enqueue RECEIVED event",
                );
            }
        }

        if (successIds.length > 0) {
            await this.deps.eventRepository.updateStatusBatch(successIds, "QUEUED", {
                queuedAt: new Date(),
            });

            this.deps.logger.info({ count: successIds.length }, "Recovery: RECEIVED events re-enqueued successfully");
        }
    }

    private async recoverQueuedEvents(): Promise<void> {
        const STUCK_THRESHOLD_MS = 5 * 60_000; // events with QUEUED status older than 5 minutes
        const BATCH_SIZE = 100;

        const stuckEvents = await this.deps.eventRepository.findByStatus("QUEUED", BATCH_SIZE);
        const now = Date.now();

        const stuckQueuedEvents = stuckEvents.filter((event) => {
            const queuedAt = event.queuedAt?.getTime() ?? event.createdAt.getTime();
            return now - queuedAt > STUCK_THRESHOLD_MS;
        });

        if (stuckQueuedEvents.length === 0) return;

        this.deps.logger.info({ count: stuckQueuedEvents.length }, "Recovery: found stuck QUEUED events, re-enqueuing");

        const successIds: string[] = [];

        for (const event of stuckQueuedEvents) {
            try {
                // Re-enqueue with replay flag to avoid jobId collision
                await this.deps.webhookQueueProducer.enqueue(
                    {
                        id: event.id,
                        source: event.source,
                        timestamp: event.createdAt,
                        headers: event.headers as Record<string, string>,
                        body: event.payload,
                        signature: event.signature ?? undefined,
                    },
                    true, // isReplay = true to use unique jobId
                );
                successIds.push(event.id);
            } catch (err) {
                this.deps.logger.error(
                    { error: (err as Error).message, eventId: event.id },
                    "Recovery: failed to re-enqueue QUEUED event",
                );
            }
        }

        if (successIds.length > 0) {
            this.deps.logger.info({ count: successIds.length }, "Recovery: QUEUED events re-enqueued successfully");
        }
    }
}
