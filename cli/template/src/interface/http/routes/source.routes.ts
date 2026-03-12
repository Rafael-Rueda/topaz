import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

interface CreateSourceBody {
    name: string;
    signatureHeader?: string;
    signatureSecret?: string;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512";
    dedupField?: string;
    dedupWindow?: string;
    rateLimitMax?: number;
    rateLimitWindow?: number;
}

interface UpdateSourceBody {
    signatureHeader?: string | null;
    signatureSecret?: string | null;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512" | null;
    dedupField?: string | null;
    dedupWindow?: string | null;
    rateLimitMax?: number | null;
    rateLimitWindow?: number | null;
    active?: boolean;
}

export async function sourceRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const sourceController = container.resolve("sourceController");

    // POST /sources — create new source
    app.post<{ Body: CreateSourceBody }>(
        "/sources",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["name"],
                    properties: {
                        name: { type: "string", minLength: 1, pattern: "^[a-z0-9-]+$" },
                        signatureHeader: { type: "string" },
                        signatureSecret: { type: "string" },
                        signatureAlgorithm: { type: "string", enum: ["HMAC_SHA256", "HMAC_SHA512"] },
                        dedupField: { type: "string" },
                        dedupWindow: { type: "string", pattern: "^\\d+[smhd]$" },
                        rateLimitMax: { type: "integer", minimum: 1 },
                        rateLimitWindow: { type: "integer", minimum: 1000 },
                    },
                },
            },
        },
        async (request, reply) => sourceController.create(request, reply),
    );

    // GET /sources — list all sources
    app.get("/sources", async (request, reply) => sourceController.findAll(request, reply));

    // GET /sources/active — list active sources only
    app.get("/sources/active", async (request, reply) => sourceController.findActive(request, reply));

    // GET /sources/name/:name — find source by name (slug)
    app.get<{ Params: { name: string } }>(
        "/sources/name/:name",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { name: { type: "string" } },
                    required: ["name"],
                },
            },
        },
        async (request, reply) => sourceController.findByName(request, reply),
    );

    // GET /sources/:id — get source by ID
    app.get<{ Params: { id: string } }>(
        "/sources/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => sourceController.findById(request, reply),
    );

    // PUT /sources/:id — update source
    app.put<{ Params: { id: string }; Body: UpdateSourceBody }>(
        "/sources/:id",
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
                        signatureHeader: { type: ["string", "null"] },
                        signatureSecret: { type: ["string", "null"] },
                        signatureAlgorithm: { type: ["string", "null"], enum: ["HMAC_SHA256", "HMAC_SHA512", null] },
                        dedupField: { type: ["string", "null"] },
                        dedupWindow: { type: ["string", "null"] },
                        rateLimitMax: { type: ["integer", "null"], minimum: 1 },
                        rateLimitWindow: { type: ["integer", "null"], minimum: 1000 },
                        active: { type: "boolean" },
                    },
                },
            },
        },
        async (request, reply) => sourceController.update(request, reply),
    );

    // DELETE /sources/:id — deactivate source (soft delete)
    app.delete<{ Params: { id: string } }>(
        "/sources/:id",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => sourceController.deactivate(request, reply),
    );

    // POST /sources/:id/activate — activate source
    app.post<{ Params: { id: string } }>(
        "/sources/:id/activate",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => sourceController.activate(request, reply),
    );

    // DELETE /sources/:id/permanent — permanently delete source
    app.delete<{ Params: { id: string } }>(
        "/sources/:id/permanent",
        {
            schema: {
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
            },
        },
        async (request, reply) => sourceController.destroy(request, reply),
    );
}
