import { BatchRecord } from "../../enterprise/entities/batch-record.js";
import type { IBatchQueueProducer } from "../interfaces/queue-producer.interface.js";

export interface ProcessBatchChunkInput {
    batchId: string;
    chunkIndex: number;
    rows: Record<string, unknown>[];
}

export interface ProcessBatchChunkOutput {
    jobId: string;
    chunkIndex: number;
    rowCount: number;
}

export interface ProcessBatchChunkDeps {
    batchQueueProducer: IBatchQueueProducer;
}

export class ProcessBatchChunkUseCase {
    constructor(private readonly deps: ProcessBatchChunkDeps) {}

    async execute(input: ProcessBatchChunkInput): Promise<ProcessBatchChunkOutput> {
        const batch = BatchRecord.create({
            batchId: input.batchId,
            chunkIndex: input.chunkIndex,
            rows: input.rows,
            totalRowsInChunk: input.rows.length,
            createdAt: new Date(),
        });

        const jobId = await this.deps.batchQueueProducer.enqueue(batch.toJSON());

        return {
            jobId,
            chunkIndex: batch.chunkIndex,
            rowCount: batch.totalRowsInChunk,
        };
    }
}
