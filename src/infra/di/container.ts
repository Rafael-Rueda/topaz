import { type AwilixContainer, asClass, asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { Redis } from "ioredis";

// Use Cases
import { IngestWebhookUseCase } from "../../domain/ingestion/application/use-cases/ingest-webhook.use-case.js";
import { ProcessBatchChunkUseCase } from "../../domain/ingestion/application/use-cases/process-batch-chunk.use-case.js";
import { BatchController } from "../../interface/http/controllers/batch.controller.js";
import { HealthController } from "../../interface/http/controllers/health.controller.js";
// Controllers
import { WebhookController } from "../../interface/http/controllers/webhook.controller.js";
// Config
import { createRedisConnection, env, logger } from "../config/index.js";
import { BatchQueueProducer } from "../queue/producers/batch-queue.producer.js";
// Queue Producers
import { WebhookQueueProducer } from "../queue/producers/webhook-queue.producer.js";

export interface Cradle {
    // Config
    env: typeof env;
    logger: typeof logger;
    redis: Redis;

    // Producers
    webhookQueueProducer: WebhookQueueProducer;
    batchQueueProducer: BatchQueueProducer;

    // Use Cases
    ingestWebhookUseCase: IngestWebhookUseCase;
    processBatchChunkUseCase: ProcessBatchChunkUseCase;

    // Controllers
    webhookController: WebhookController;
    batchController: BatchController;
    healthController: HealthController;
}

export type AppContainer = AwilixContainer<Cradle>;

export function createAppContainer(): AppContainer {
    const container = createContainer<Cradle>({
        injectionMode: InjectionMode.PROXY,
        strict: true,
    });

    container.register({
        // Config - Singletons
        env: asValue(env),
        logger: asValue(logger),
        redis: asFunction(createRedisConnection).singleton(),

        // Queue Producers - Singletons
        webhookQueueProducer: asClass(WebhookQueueProducer)
            .singleton()
            .inject((container) => ({ connection: container.resolve("redis") }))
            .classic(),
        batchQueueProducer: asClass(BatchQueueProducer)
            .singleton()
            .inject((container) => ({ connection: container.resolve("redis") }))
            .classic(),

        // Use Cases - Transient (new instance each time)
        ingestWebhookUseCase: asClass(IngestWebhookUseCase).transient(),
        processBatchChunkUseCase: asClass(ProcessBatchChunkUseCase).transient(),

        // Controllers - Scoped per request
        webhookController: asClass(WebhookController).scoped(),
        batchController: asClass(BatchController).scoped(),
        healthController: asClass(HealthController).scoped(),
    });

    return container;
}

let containerInstance: AppContainer | null = null;

export function getContainer(): AppContainer {
    if (!containerInstance) {
        containerInstance = createAppContainer();
    }
    return containerInstance;
}

export async function disposeContainer(): Promise<void> {
    if (containerInstance) {
        await containerInstance.dispose();
        containerInstance = null;
    }
}
