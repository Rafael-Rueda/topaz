import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
import csvParser from "csv-parser";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ProcessBatchChunkUseCase } from "../../../domain/ingestion/application/use-cases/process-batch-chunk.use-case.js";
import { BatchId } from "../../../domain/ingestion/enterprise/value-objects/batch-id.js";
import type { Env } from "../../../infra/config/env.js";
import type { Logger } from "../../../infra/config/logger.js";

export interface BatchControllerDeps {
    processBatchChunkUseCase: ProcessBatchChunkUseCase;
    logger: Logger;
    env: Env;
}

interface BatchStats {
    totalRows: number;
    chunksProcessed: number;
    errors: string[];
}

export class BatchController {
    constructor(private readonly deps: BatchControllerDeps) {}

    async ingestCsv(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const batchId = BatchId.generate();
        const chunkSize = this.deps.env.BATCH_CHUNK_SIZE;

        this.deps.logger.info({ batchId: batchId.toString(), chunkSize }, "Starting CSV batch ingestion");

        let file: MultipartFile | undefined;

        try {
            file = await request.file();

            if (!file) {
                reply.status(400).send({
                    error: "No file provided",
                    message: "Please upload a CSV file",
                });
                return;
            }

            const stats = await this.processFileStream(file, batchId, chunkSize);

            this.deps.logger.info({ batchId: batchId.toString(), ...stats }, "CSV batch ingestion completed");

            reply.status(200).send({
                status: "accepted",
                batchId: batchId.toString(),
                stats: {
                    totalRows: stats.totalRows,
                    chunksQueued: stats.chunksProcessed,
                },
                message: "Batch queued for processing",
            });
        } catch (error) {
            this.deps.logger.error({ error, batchId: batchId.toString() }, "Failed to process CSV batch");

            reply.status(500).send({
                error: "Processing failed",
                batchId: batchId.toString(),
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    private async processFileStream(file: MultipartFile, batchId: BatchId, chunkSize: number): Promise<BatchStats> {
        const stats: BatchStats = {
            totalRows: 0,
            chunksProcessed: 0,
            errors: [],
        };

        let rowBuffer: Record<string, unknown>[] = [];
        let chunkIndex = 0;

        const chunkerTransform = new Transform({
            objectMode: true,
            transform: async (row: Record<string, unknown>, _encoding: BufferEncoding, callback: TransformCallback) => {
                rowBuffer.push(row);
                stats.totalRows++;

                if (rowBuffer.length >= chunkSize) {
                    // Pause stream processing while we queue the chunk
                    try {
                        await this.queueChunk(batchId, chunkIndex, rowBuffer);
                        stats.chunksProcessed++;
                        chunkIndex++;
                        rowBuffer = [];
                        callback();
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : "Unknown error";
                        stats.errors.push(`Chunk ${chunkIndex}: ${errorMsg}`);
                        callback(new Error(errorMsg));
                    }
                } else {
                    callback();
                }
            },
            flush: async (callback: TransformCallback) => {
                // Process remaining rows in buffer
                if (rowBuffer.length > 0) {
                    try {
                        await this.queueChunk(batchId, chunkIndex, rowBuffer);
                        stats.chunksProcessed++;
                        callback();
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : "Unknown error";
                        stats.errors.push(`Final chunk: ${errorMsg}`);
                        callback(new Error(errorMsg));
                    }
                } else {
                    callback();
                }
            },
        });

        await pipeline(
            file.file,
            csvParser({
                strict: true,
                skipComments: true,
            }),
            chunkerTransform,
        );

        return stats;
    }

    private async queueChunk(batchId: BatchId, chunkIndex: number, rows: Record<string, unknown>[]): Promise<void> {
        this.deps.logger.debug({ batchId: batchId.toString(), chunkIndex, rowCount: rows.length }, "Queueing chunk");

        await this.deps.processBatchChunkUseCase.execute({
            batchId: batchId.toString(),
            chunkIndex,
            rows: [...rows], // Copy to avoid mutation issues
        });
    }
}
