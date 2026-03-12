import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface CreateTransformBody {
    source: string;
    eventType: string;
    mapping: Record<string, string>;
}

interface UpdateTransformBody {
    mapping?: Record<string, string>;
    active?: boolean;
}

interface TestTransformBody {
    source: string;
    eventType: string;
    payload: unknown;
}

export async function transformRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const transformController = container.resolve("transformController");

    // POST /transforms — create new transform
    app.post<{ Body: CreateTransformBody }>(
        "/transforms",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["source", "eventType", "mapping"],
                    properties: {
                        source: { type: "string", minLength: 1 },
                        eventType: { type: "string", minLength: 1 },
                        mapping: { type: "object" },
                    },
                },
            },
        },
        async (request, reply) => transformController.create(request, reply),
    );

    // GET /transforms — list all
    app.get("/transforms", async (request, reply) => transformController.findAll(request, reply));

    // GET /transforms/source/:source — list by source
    app.get<{ Params: { source: string } }>(
        "/transforms/source/:source",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { source: { type: "string" } },
                    required: ["source"],
                },
            },
        },
        async (request, reply) => transformController.findBySource(request, reply),
    );

    // GET /transforms/:id — get by ID
    app.get<{ Params: { id: string } }>(
        "/transforms/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => transformController.findById(request, reply),
    );

    // PUT /transforms/:id — update transform
    app.put<{ Params: { id: string }; Body: UpdateTransformBody }>(
        "/transforms/:id",
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
                        mapping: { type: "object" },
                        active: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => transformController.update(request, reply),
    );

    // DELETE /transforms/:id — deactivate (soft delete)
    app.delete<{ Params: { id: string } }>(
        "/transforms/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => transformController.deactivate(request, reply),
    );

    // DELETE /transforms/:id/permanent — permanently delete
    app.delete<{ Params: { id: string } }>(
        "/transforms/:id/permanent",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => transformController.destroy(request, reply),
    );

    // POST /transforms/test — test a transform against sample payload
    app.post<{ Body: TestTransformBody }>(
        "/transforms/test",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["source", "eventType", "payload"],
                    properties: {
                        source: { type: "string", minLength: 1 },
                        eventType: { type: "string", minLength: 1 },
                        payload: {},
                    },
                },
            },
        },
        async (request, reply) => transformController.test(request, reply),
    );
}
