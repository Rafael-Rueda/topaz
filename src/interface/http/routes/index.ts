import type { FastifyInstance } from "fastify";

import { batchRoutes } from "./batch.routes.js";
import { healthRoutes } from "./health.routes.js";
import { webhookRoutes } from "./webhook.routes.js";
import type { AppContainer } from "../../../infra/di/container.js";

export async function registerRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    await healthRoutes(app, container);
    await webhookRoutes(app, container);
    await batchRoutes(app, container);
}
