import { nanoid } from "nanoid";

import { WebhookPayload } from "../../enterprise/entities/webhook-payload.js";
import type { IWebhookQueueProducer } from "../interfaces/queue-producer.interface.js";

export interface IngestWebhookInput {
    source: string;
    headers: Record<string, string>;
    body: unknown;
    signature?: string;
}

export interface IngestWebhookOutput {
    id: string;
    queued: boolean;
}

export interface IngestWebhookDeps {
    webhookQueueProducer: IWebhookQueueProducer;
}

export class IngestWebhookUseCase {
    constructor(private readonly deps: IngestWebhookDeps) {}

    async execute(input: IngestWebhookInput): Promise<IngestWebhookOutput> {
        const payload = WebhookPayload.create({
            id: nanoid(),
            source: input.source,
            timestamp: new Date(),
            headers: input.headers,
            body: input.body,
            signature: input.signature,
        });

        const jobId = await this.deps.webhookQueueProducer.enqueue(payload.toJSON());

        return {
            id: jobId,
            queued: true,
        };
    }
}
