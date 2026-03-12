import type { IEventRepository } from "../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { IWebhookQueueProducer } from "../../domain/ingestion/application/interfaces/queue-producer.interface.js";
import type { Logger } from "../config/logger.js";

export interface RecoveryJobDeps {
    eventRepository: IEventRepository;
    webhookQueueProducer: IWebhookQueueProducer;
    logger: Logger;
}

/**
 * Recovery Job — re-enqueues events stuck with RECEIVED status.
 *
 * This happens when:
 * - Postgres saved but Redis was down
 * - The process crashed between INSERT and enqueue
 *
 * Runs every 30s via BullMQ repeatable job.
 */
export class RecoveryJob {
    constructor(private readonly deps: RecoveryJobDeps) {}

    async execute(): Promise<void> {
        const STUCK_THRESHOLD_MS = 60_000; // events with RECEIVED status older than 1 minute
        const BATCH_SIZE = 100;

        const stuckEvents = await this.deps.eventRepository.findStuckReceived(STUCK_THRESHOLD_MS, BATCH_SIZE);

        if (stuckEvents.length === 0) return;

        this.deps.logger.info({ count: stuckEvents.length }, "Recovery: found stuck events, re-enqueuing");

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
                    "Recovery: failed to re-enqueue event",
                );
            }
        }

        if (successIds.length > 0) {
            await this.deps.eventRepository.updateStatusBatch(successIds, "QUEUED", {
                queuedAt: new Date(),
            });

            this.deps.logger.info({ count: successIds.length }, "Recovery: events re-enqueued successfully");
        }
    }
}
