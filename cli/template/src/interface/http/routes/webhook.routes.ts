import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface WebhookParams {
    source: string;
}

export async function webhookRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const webhookController = container.resolve("webhookController");

    app.post<{ Params: WebhookParams }>(
        "/webhooks/:source",
        {
            schema: {
                params: {
                    type: "object",
                    properties: {
                        source: { type: "string", minLength: 1, maxLength: 100 },
                    },
                    required: ["source"],
                },
                response: {
                    202: {
                        type: "object",
                        properties: {
                            status: { type: "string" },
                            eventId: { type: "string" },
                            message: { type: "string" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            return webhookController.ingest(request, reply);
        },
    );
}
