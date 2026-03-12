import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface CreateSchemaBody {
    source: string;
    eventType: string;
    schema: object;
    rejectOnFail?: boolean;
}

interface UpdateSchemaBody {
    schema?: object;
    rejectOnFail?: boolean;
    active?: boolean;
}

export async function schemaRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const schemaController = container.resolve("schemaController");

    // POST /schemas — create new schema
    app.post<{ Body: CreateSchemaBody }>(
        "/schemas",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["source", "eventType", "schema"],
                    properties: {
                        source: { type: "string", minLength: 1 },
                        eventType: { type: "string", minLength: 1 },
                        schema: { type: "object" },
                        rejectOnFail: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => schemaController.create(request, reply),
    );

    // GET /schemas — list all
    app.get("/schemas", async (request, reply) => schemaController.findAll(request, reply));

    // GET /schemas/source/:source — list by source
    app.get<{ Params: { source: string } }>(
        "/schemas/source/:source",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { source: { type: "string" } },
                    required: ["source"],
                },
            },
        },
        async (request, reply) => schemaController.findBySource(request, reply),
    );

    // GET /schemas/source/:source/:eventType — find active schema
    app.get<{ Params: { source: string; eventType: string } }>(
        "/schemas/source/:source/:eventType",
        {
            schema: {
                params: {
                    type: "object",
                    properties: {
                        source: { type: "string" },
                        eventType: { type: "string" },
                    },
                    required: ["source", "eventType"],
                },
            },
        },
        async (request, reply) => schemaController.findActive(request, reply),
    );

    // PUT /schemas/:id — update schema
    app.put<{ Params: { id: string }; Body: UpdateSchemaBody }>(
        "/schemas/:id",
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
                        schema: { type: "object" },
                        rejectOnFail: { type: "boolean" },
                        active: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => schemaController.update(request, reply),
    );

    // DELETE /schemas/:id — deactivate schema (soft delete)
    app.delete<{ Params: { id: string } }>(
        "/schemas/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => schemaController.deactivate(request, reply),
    );

    // DELETE /schemas/:id/permanent — permanently delete schema
    app.delete<{ Params: { id: string } }>(
        "/schemas/:id/permanent",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => schemaController.destroy(request, reply),
    );
}
