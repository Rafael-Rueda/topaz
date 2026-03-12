export const QUEUE_NAMES = {
    WEBHOOK_INGEST: "webhook-ingest-queue",
    BATCH_PROCESSING: "batch-processing-queue",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
