import type { FastifyReply, FastifyRequest } from "fastify";

import type { IngestWebhookUseCase } from "../../../domain/ingestion/application/use-cases/ingest-webhook.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface WebhookParams {
    source: string;
}

export interface WebhookControllerDeps {
    ingestWebhookUseCase: IngestWebhookUseCase;
    logger: Logger;
}

export class WebhookController {
    constructor(private readonly deps: WebhookControllerDeps) {}

    async ingest(request: FastifyRequest<{ Params: WebhookParams }>, reply: FastifyReply): Promise<void> {
        const { source } = request.params;
        const signature = request.headers["x-webhook-signature"] as string | undefined;

        this.deps.logger.debug({ source }, "Webhook received");

        try {
            const result = await this.deps.ingestWebhookUseCase.execute({
                source,
                headers: request.headers as Record<string, string>,
                body: request.body,
                signature,
            });

            this.deps.logger.info({ jobId: result.id, source }, "Webhook queued");

            reply.status(202).send({
                status: "accepted",
                jobId: result.id,
                message: "Payload queued for processing",
            });
        } catch (error) {
            this.deps.logger.error({ error, source }, "Failed to queue webhook");
            throw error;
        }
    }
}
