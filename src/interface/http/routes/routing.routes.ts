import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface CreateRouteBody {
    source: string;
    eventType?: string;
    targetUrl: string;
    targetName: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
}

interface UpdateRouteBody {
    targetUrl?: string;
    targetName?: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
    active?: boolean;
}

export async function routingRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const routingController = container.resolve("routingController");

    // POST /routes — create new route
    app.post<{ Body: CreateRouteBody }>(
        "/routes",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["source", "targetUrl", "targetName"],
                    properties: {
                        source: { type: "string", minLength: 1 },
                        eventType: { type: "string" },
                        targetUrl: { type: "string", format: "uri" },
                        targetName: { type: "string", minLength: 1 },
                        method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
                        timeout: { type: "integer", minimum: 1000, maximum: 60000 },
                        retryCount: { type: "integer", minimum: 0, maximum: 10 },
                        retryBackoff: { type: "string", enum: ["FIXED", "EXPONENTIAL"] },
                        priority: { type: "string", enum: ["CRITICAL", "HIGH", "NORMAL", "LOW"] },
                        headers: { type: "object" },
                    },
                },
            },
        },
        async (request, reply) => routingController.create(request, reply),
    );

    // GET /routes — list all routes
    app.get("/routes", async (request, reply) => routingController.findAll(request, reply));

    // GET /routes/source/:source — list routes by source
    app.get<{ Params: { source: string } }>(
        "/routes/source/:source",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { source: { type: "string" } },
                    required: ["source"],
                },
            },
        },
        async (request, reply) => routingController.findBySource(request, reply),
    );

    // GET /routes/:id — get route by ID
    app.get<{ Params: { id: string } }>(
        "/routes/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => routingController.findById(request, reply),
    );

    // PUT /routes/:id — update route
    app.put<{ Params: { id: string }; Body: UpdateRouteBody }>(
        "/routes/:id",
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
                        targetUrl: { type: "string", format: "uri" },
                        targetName: { type: "string", minLength: 1 },
                        method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
                        timeout: { type: "integer", minimum: 1000, maximum: 60000 },
                        retryCount: { type: "integer", minimum: 0, maximum: 10 },
                        retryBackoff: { type: "string", enum: ["FIXED", "EXPONENTIAL"] },
                        priority: { type: "string", enum: ["CRITICAL", "HIGH", "NORMAL", "LOW"] },
                        headers: { type: "object" },
                        active: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => routingController.update(request, reply),
    );

    // DELETE /routes/:id — deactivate route (soft delete)
    app.delete<{ Params: { id: string } }>(
        "/routes/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => routingController.deactivate(request, reply),
    );

    // POST /routes/:id/activate — activate route
    app.post<{ Params: { id: string } }>(
        "/routes/:id/activate",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => routingController.activate(request, reply),
    );

    // DELETE /routes/:id/permanent — permanently delete route
    app.delete<{ Params: { id: string } }>(
        "/routes/:id/permanent",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => routingController.destroy(request, reply),
    );
}
