import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

export async function batchRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const batchController = container.resolve("batchController");

    app.post(
        "/ingest/batch",
        {
            schema: {
                consumes: ["multipart/form-data"],
                response: {
                    200: {
                        type: "object",
                        properties: {
                            status: { type: "string" },
                            batchId: { type: "string" },
                            stats: {
                                type: "object",
                                properties: {
                                    totalRows: { type: "number" },
                                    chunksQueued: { type: "number" },
                                },
                            },
                            message: { type: "string" },
                        },
                    },
                    400: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                            message: { type: "string" },
                        },
                    },
                    500: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                            batchId: { type: "string" },
                            message: { type: "string" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            return batchController.ingestCsv(request, reply);
        },
    );
}
