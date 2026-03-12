import type { FastifyReply, FastifyRequest } from "fastify";

import {
    type IngestWebhookUseCase,
    SchemaValidationError,
} from "../../../domain/ingestion/application/use-cases/ingest-webhook.use-case.js";
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

            if (result.duplicate) {
                this.deps.logger.info({ eventId: result.id, source }, "Duplicate webhook ignored");
                reply.status(202).send({
                    status: "duplicate",
                    eventId: result.id,
                    message: "Duplicate event — already received",
                });
                return;
            }

            this.deps.logger.info({ eventId: result.id, source }, "Webhook persisted and queued");

            reply.status(202).send({
                status: "accepted",
                eventId: result.id,
                message: "Payload persisted and queued for processing",
            });
        } catch (error) {
            if (error instanceof SchemaValidationError) {
                reply.status(400).send({
                    error: "Schema validation failed",
                    statusCode: 400,
                    validationErrors: error.errors,
                });
                return;
            }

            // Postgres failed → 500 → emitter retries
            const err = error instanceof Error ? error : new Error(String(error));
            this.deps.logger.error(
                { err: { message: err.message, stack: err.stack }, source },
                "Failed to persist webhook",
            );
            reply.status(500).send({
                error: "Internal Server Error",
                message: err.message,
                statusCode: 500,
            });
        }
    }
}
