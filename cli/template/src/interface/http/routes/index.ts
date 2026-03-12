import type { FastifyInstance } from "fastify";

import { alertRoutes } from "./alert.routes.js";
import { batchRoutes } from "./batch.routes.js";
import { dlqRoutes } from "./dlq.routes.js";
import { healthRoutes } from "./health.routes.js";
import { metricsRoutes } from "./metrics.routes.js";
import { replayRoutes } from "./replay.routes.js";
import { routingRoutes } from "./routing.routes.js";
import { schemaRoutes } from "./schema.routes.js";
import { sourceRoutes } from "./source.routes.js";
import { transformRoutes } from "./transform.routes.js";
import { webhookRoutes } from "./webhook.routes.js";
import type { AppContainer } from "../../../infra/di/container.js";

export async function registerRoutes(app: FastifyInstance, container: AppContainer): Promise<void> {
    await healthRoutes(app, container);
    await webhookRoutes(app, container);
    await batchRoutes(app, container);
    await schemaRoutes(app, container);
    await routingRoutes(app, container);
    await transformRoutes(app, container);
    await replayRoutes(app, container);
    await metricsRoutes(app, container);
    await dlqRoutes(app, container);
    await alertRoutes(app, container);
    await sourceRoutes(app, container);
}
