import { type Job, Worker } from "bullmq";
import type { Redis } from "ioredis";

import type { BatchRecordProps } from "../../../domain/ingestion/enterprise/entities/batch-record.js";
import { env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { QUEUE_NAMES } from "../queues.js";

export interface BatchWorkerDeps {
    connection: Redis;
    logger: Logger;
}

export class BatchWorker {
    private worker: Worker | null = null;

    constructor(private readonly deps: BatchWorkerDeps) {}

    start(): void {
        this.worker = new Worker<BatchRecordProps>(
            QUEUE_NAMES.BATCH_PROCESSING,
            async (job: Job<BatchRecordProps>) => {
                return this.processJob(job);
            },
            {
                connection: this.deps.connection,
                prefix: env.QUEUE_PREFIX,
                concurrency: 5,
                limiter: {
                    max: 20,
                    duration: 1000,
                },
            },
        );

        this.worker.on("completed", (job) => {
            this.deps.logger.info(
                {
                    jobId: job.id,
                    batchId: job.data.batchId,
                    chunkIndex: job.data.chunkIndex,
                },
                "Batch chunk job completed",
            );
        });

        this.worker.on("failed", (job, err) => {
            this.deps.logger.error(
                {
                    jobId: job?.id,
                    batchId: job?.data.batchId,
                    error: err.message,
                },
                "Batch chunk job failed",
            );
        });

        this.worker.on("error", (err) => {
            this.deps.logger.error({ error: err.message }, "Batch worker error");
        });

        this.deps.logger.info("Batch worker started");
    }

    private async processJob(job: Job<BatchRecordProps>): Promise<void> {
        const { batchId, chunkIndex, rows, totalRowsInChunk } = job.data;

        this.deps.logger.debug(
            { jobId: job.id, batchId, chunkIndex, rowCount: totalRowsInChunk },
            "Processing batch chunk",
        );

        // =====================================================
        // IMPLEMENTATION HOOK: Add your business logic here
        // =====================================================
        // Examples:
        // - Validate each row against schema
        // - Transform/normalize data
        // - Bulk insert to database
        // - Update processing progress
        // - Emit domain events
        //
        // const repository = this.deps.recordRepository;
        // await repository.bulkInsert(rows);
        //
        // Process rows with validation:
        // for (const row of rows) {
        //   const validated = RecordSchema.safeParse(row);
        //   if (validated.success) {
        //     await repository.insert(validated.data);
        //   } else {
        //     this.deps.logger.warn({ row, errors: validated.error }, 'Invalid row');
        //   }
        // }
        // =====================================================

        // Simulate batch processing (remove in production)
        await this.simulateBatchProcessing(rows);

        this.deps.logger.info(
            { batchId, chunkIndex, processedRows: totalRowsInChunk },
            "Batch chunk processed successfully",
        );
    }

    private async simulateBatchProcessing(rows: Record<string, unknown>[]): Promise<void> {
        // Simulate processing ~10ms per row, with minimum 50ms
        const processingTime = Math.max(50, rows.length * 10);
        await new Promise((resolve) => setTimeout(resolve, processingTime));
    }

    async stop(): Promise<void> {
        if (this.worker) {
            await this.worker.close();
            this.deps.logger.info("Batch worker stopped");
        }
    }
}
