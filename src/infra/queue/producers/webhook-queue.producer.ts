import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import type { IWebhookQueueProducer } from "../../../domain/ingestion/application/interfaces/queue-producer.interface.js";
import type { WebhookPayloadProps } from "../../../domain/ingestion/enterprise/entities/webhook-payload.js";
import { env } from "../../config/env.js";
import { QUEUE_NAMES } from "../queues.js";

export class WebhookQueueProducer implements IWebhookQueueProducer {
    private readonly queue: Queue;

    constructor(connection: Redis) {
        this.queue = new Queue(QUEUE_NAMES.WEBHOOK_INGEST, {
            connection,
            prefix: env.QUEUE_PREFIX,
            defaultJobOptions: {
                removeOnComplete: 1000,
                removeOnFail: 5000,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            },
        });
    }

    async enqueue(payload: WebhookPayloadProps, isReplay = false): Promise<string> {
        // For replays, use a unique jobId to avoid collision with failed jobs
        const jobId = isReplay ? `${payload.id}:replay:${Date.now()}` : payload.id;

        const job = await this.queue.add(`webhook:${payload.source}`, payload, {
            jobId,
        });

        return job.id ?? payload.id;
    }

    async close(): Promise<void> {
        await this.queue.close();
    }
}
