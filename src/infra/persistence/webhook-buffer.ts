import type {
    IEventRepository,
    SaveEventInput,
} from "../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { IWebhookQueueProducer } from "../../domain/ingestion/application/interfaces/queue-producer.interface.js";
import type { WebhookPayloadProps } from "../../domain/ingestion/enterprise/entities/webhook-payload.js";
import type { Logger } from "../config/logger.js";

interface BufferEntry {
    event: SaveEventInput;
    queuePayload: WebhookPayloadProps;
    resolve: (result: { id: string }) => void;
    reject: (error: Error) => void;
}

export interface WebhookBufferDeps {
    eventRepository: IEventRepository;
    webhookQueueProducer: IWebhookQueueProducer;
    logger: Logger;
}

export class WebhookBuffer {
    private buffer: BufferEntry[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private readonly flushInterval: number;
    private readonly maxSize: number;
    private flushing = false;

    constructor(
        private readonly deps: WebhookBufferDeps,
        options?: { flushInterval?: number; maxSize?: number },
    ) {
        this.flushInterval = options?.flushInterval ?? 50;
        this.maxSize = options?.maxSize ?? 500;
    }

    async add(event: SaveEventInput, queuePayload: WebhookPayloadProps): Promise<{ id: string }> {
        return new Promise<{ id: string }>((resolve, reject) => {
            this.buffer.push({ event, queuePayload, resolve, reject });

            if (this.buffer.length >= this.maxSize) {
                this.flush();
                return;
            }

            if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.flushInterval);
            }
        });
    }

    private async flush(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.buffer.length === 0 || this.flushing) return;

        this.flushing = true;
        const batch = this.buffer.splice(0);

        try {
            // 1. Persist to Postgres (WAL - source of truth)
            await this.deps.eventRepository.saveBatch(batch.map((b) => b.event));

            // 2. Enqueue to Redis (processing engine)
            try {
                const ids = batch.map((b) => b.event.id);

                for (const entry of batch) {
                    await this.deps.webhookQueueProducer.enqueue(entry.queuePayload);
                }

                // 3. Update status to QUEUED
                await this.deps.eventRepository.updateStatusBatch(ids, "QUEUED", {
                    queuedAt: new Date(),
                });
            } catch (redisError) {
                // Redis failed, but Postgres saved successfully.
                // Events remain with RECEIVED status.
                // The recovery job will re-enqueue them.
                this.deps.logger.warn(
                    { error: (redisError as Error).message, count: batch.length },
                    "Redis enqueue failed after Postgres save — recovery job will handle",
                );
            }

            // 4. Resolve all promises (202 to the emitter)
            for (const entry of batch) {
                entry.resolve({ id: entry.event.id });
            }
        } catch (pgError) {
            // Postgres failed — NOTHING was saved.
            // Reject all promises (500 to the emitter → emitter retries).
            this.deps.logger.error(
                { error: (pgError as Error).message, count: batch.length },
                "Postgres batch insert failed — all events rejected",
            );

            for (const entry of batch) {
                entry.reject(new Error("Failed to persist event"));
            }
        } finally {
            this.flushing = false;

            // If more entries accumulated during flush, flush again
            if (this.buffer.length > 0) {
                this.flush();
            }
        }
    }

    async shutdown(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.buffer.length > 0) {
            this.deps.logger.info({ pending: this.buffer.length }, "Flushing remaining buffer on shutdown");
            await this.flush();
        }
    }

    get pendingCount(): number {
        return this.buffer.length;
    }
}
