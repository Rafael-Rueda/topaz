import type { BatchRecordProps } from "../../enterprise/entities/batch-record.js";
import type { WebhookPayloadProps } from "../../enterprise/entities/webhook-payload.js";

export interface IWebhookQueueProducer {
    enqueue(payload: WebhookPayloadProps): Promise<string>;
}

export interface IBatchQueueProducer {
    enqueue(batch: BatchRecordProps): Promise<string>;
}

export const QUEUE_PRODUCER_TOKENS = {
    WEBHOOK: "webhookQueueProducer",
    BATCH: "batchQueueProducer",
} as const;
