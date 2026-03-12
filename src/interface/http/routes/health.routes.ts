import type { FastifyInstance } from "fastify";

import type { AppContainer } from "../../../infra/di/container.js";

export async function healthRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    const healthController = container.resolve("healthController");

    app.get("/health", async (request, reply) => {
        return healthController.check(request, reply);
    });

    app.get("/health/ready", async (request, reply) => {
        return healthController.readiness(request, reply);
    });

    app.get("/health/live", async (request, reply) => {
        return healthController.liveness(request, reply);
    });
}
