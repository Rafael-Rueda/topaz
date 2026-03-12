import type { FastifyInstance } from "fastify";

import type { AlertMetric } from "../../../generated/prisma/client.js";
import type { AppContainer } from "../../../infra/di/container.js";

interface CreateAlertBody {
    name: string;
    metric: AlertMetric;
    threshold: number;
    window: string;
    targetUrl: string;
    cooldown?: string;
}

interface UpdateAlertBody {
    name?: string;
    threshold?: number;
    window?: string;
    targetUrl?: string;
    cooldown?: string;
    active?: boolean;
}

export async function alertRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const alertController = container.resolve("alertController");

    // POST /alerts — create alert rule
    app.post<{ Body: CreateAlertBody }>(
        "/alerts",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["name", "metric", "threshold", "window", "targetUrl"],
                    properties: {
                        name: { type: "string", minLength: 1 },
                        metric: {
                            type: "string",
                            enum: ["ERROR_RATE", "QUEUE_SIZE", "LATENCY_P95", "DLQ_SIZE", "SCHEMA_DRIFT"],
                        },
                        threshold: { type: "number" },
                        window: { type: "string" },
                        targetUrl: { type: "string", format: "uri" },
                        cooldown: { type: "string" },
                    },
                },
            },
        },
        async (request, reply) => alertController.create(request, reply),
    );

    // GET /alerts — list all rules
    app.get("/alerts", async (request, reply) => alertController.findAll(request, reply));

    // GET /alerts/history — alert history
    app.get<{ Querystring: { alertRuleId?: string; limit?: number } }>(
        "/alerts/history",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        alertRuleId: { type: "string" },
                        limit: { type: "integer", minimum: 1, maximum: 100 },
                    },
                },
            },
        },
        async (request, reply) => alertController.history(request, reply),
    );

    // PUT /alerts/:id — update rule
    app.put<{ Params: { id: string }; Body: UpdateAlertBody }>(
        "/alerts/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
                body: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        threshold: { type: "number" },
                        window: { type: "string" },
                        targetUrl: { type: "string" },
                        cooldown: { type: "string" },
                        active: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => alertController.update(request, reply),
    );

    // DELETE /alerts/:id — deactivate rule
    app.delete<{ Params: { id: string } }>(
        "/alerts/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => alertController.deactivate(request, reply),
    );

    // DELETE /alerts/:id/permanent — permanently delete alert rule
    app.delete<{ Params: { id: string } }>(
        "/alerts/:id/permanent",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => alertController.deletePermanent(request, reply),
    );
}
