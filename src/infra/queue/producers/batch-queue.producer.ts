import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import type { IBatchQueueProducer } from "../../../domain/ingestion/application/interfaces/queue-producer.interface.js";
import type { BatchRecordProps } from "../../../domain/ingestion/enterprise/entities/batch-record.js";
import { env } from "../../config/env.js";
import { QUEUE_NAMES } from "../queues.js";

export class BatchQueueProducer implements IBatchQueueProducer {
    private readonly queue: Queue;

    constructor(connection: Redis) {
        this.queue = new Queue(QUEUE_NAMES.BATCH_PROCESSING, {
            connection,
            prefix: env.QUEUE_PREFIX,
            defaultJobOptions: {
                removeOnComplete: 1000,
                removeOnFail: 5000,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 2000,
                },
            },
        });
    }

    async enqueue(batch: BatchRecordProps): Promise<string> {
        const jobId = `${batch.batchId}:chunk:${batch.chunkIndex}`;

        const job = await this.queue.add("batch:chunk", batch, {
            jobId,
        });

        return job.id ?? jobId;
    }

    async close(): Promise<void> {
        await this.queue.close();
    }
}
