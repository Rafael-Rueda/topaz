import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

export async function metricsRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const metricsController = container.resolve("metricsController");

    app.get("/metrics/overview", async (request, reply) => metricsController.overview(request, reply));

    app.get<{ Querystring: { minutes?: number } }>(
        "/metrics/throughput",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: { minutes: { type: "integer", minimum: 1, maximum: 1440 } },
                },
            },
        },
        async (request, reply) => metricsController.throughput(request, reply),
    );

    app.get("/metrics/latency", async (request, reply) => metricsController.latency(request, reply));

    app.get<{ Querystring: { minutes?: number } }>(
        "/metrics/errors",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: { minutes: { type: "integer", minimum: 1, maximum: 1440 } },
                },
            },
        },
        async (request, reply) => metricsController.errors(request, reply),
    );

    app.get("/metrics/queues", async (request, reply) => metricsController.queues(request, reply));

    app.get("/metrics/dlq", async (request, reply) => metricsController.dlqSummary(request, reply));
}
