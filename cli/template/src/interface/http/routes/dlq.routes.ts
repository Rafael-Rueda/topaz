import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

export async function dlqRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const dlqController = container.resolve("dlqController");

    // GET /dlq — list DLQ events with filters
    app.get<{ Querystring: { source?: string; eventType?: string; limit?: number; offset?: number } }>(
        "/dlq",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        source: { type: "string" },
                        eventType: { type: "string" },
                        limit: { type: "integer", minimum: 1, maximum: 100 },
                        offset: { type: "integer", minimum: 0 },
                    },
                },
            },
        },
        async (request, reply) => dlqController.list(request, reply),
    );

    // GET /dlq/:id — get full event payload
    app.get<{ Params: { id: string } }>(
        "/dlq/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => dlqController.getEvent(request, reply),
    );

    // POST /dlq/:id/discard — discard a single event
    app.post<{ Params: { id: string } }>(
        "/dlq/:id/discard",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => dlqController.discard(request, reply),
    );

    // POST /dlq/discard — batch discard
    app.post<{ Body: { ids: string[] } }>(
        "/dlq/discard",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["ids"],
                    properties: {
                        ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 },
                    },
                },
            },
        },
        async (request, reply) => dlqController.discardBatch(request, reply),
    );
}
