import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface PreviewBody {
    filterSource?: string;
    filterEventType?: string;
    filterStatus?: "FAILED" | "DEAD" | "DELIVERED";
    filterFrom?: string;
    filterTo?: string;
}

interface ExecuteBody extends PreviewBody {
    requestedBy?: string;
}

const filterBodySchema = {
    type: "object" as const,
    properties: {
        filterSource: { type: "string" as const, minLength: 1 },
        filterEventType: { type: "string" as const, minLength: 1 },
        filterStatus: { type: "string" as const, enum: ["FAILED", "DEAD", "DELIVERED"] },
        filterFrom: { type: "string" as const, minLength: 1 },
        filterTo: { type: "string" as const, minLength: 1 },
        requestedBy: { type: "string" as const, minLength: 1 },
    },
};

export async function replayRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const replayController = container.resolve("replayController");

    // POST /replay/preview — dry-run: count events that match filters
    app.post<{ Body: PreviewBody }>("/replay/preview", { schema: { body: filterBodySchema } }, async (request, reply) =>
        replayController.preview(request, reply),
    );

    // POST /replay/execute — create and start a replay
    app.post<{ Body: ExecuteBody }>(
        "/replay/execute",
        {
            schema: { body: filterBodySchema },
        },
        async (request, reply) => replayController.execute(request, reply),
    );

    // GET /replay/history — list past replays (must be before /:id to avoid collision)
    app.get<{ Querystring: { limit?: number; offset?: number } }>(
        "/replay/history",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        limit: { type: "integer", minimum: 1, maximum: 100 },
                        offset: { type: "integer", minimum: 0 },
                    },
                },
            },
        },
        async (request, reply) => replayController.history(request, reply),
    );

    // GET /replay/:id — status and progress of a replay
    app.get<{ Params: { id: string } }>(
        "/replay/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => replayController.getStatus(request, reply),
    );

    // POST /replay/:id/cancel — cancel a replay
    app.post<{ Params: { id: string } }>(
        "/replay/:id/cancel",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => replayController.cancel(request, reply),
    );
}
