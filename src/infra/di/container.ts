import { type AwilixContainer, asClass, asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { Redis } from "ioredis";

import { ApplyTransformUseCase } from "../../domain/ingestion/application/use-cases/apply-transform.use-case.js";
import { DeduplicateEventUseCase } from "../../domain/ingestion/application/use-cases/deduplicate-event.use-case.js";
import { ExecuteDeliveryUseCase } from "../../domain/ingestion/application/use-cases/execute-delivery.use-case.js";
import { ExecuteReplayUseCase } from "../../domain/ingestion/application/use-cases/execute-replay.use-case.js";
// Use Cases
import { IngestWebhookUseCase } from "../../domain/ingestion/application/use-cases/ingest-webhook.use-case.js";
import { ManageRouteUseCase } from "../../domain/ingestion/application/use-cases/manage-route.use-case.js";
import { ManageSchemaUseCase } from "../../domain/ingestion/application/use-cases/manage-schema.use-case.js";
import { ManageSourceUseCase } from "../../domain/ingestion/application/use-cases/manage-source.use-case.js";
import { ProcessBatchChunkUseCase } from "../../domain/ingestion/application/use-cases/process-batch-chunk.use-case.js";
import { ReconcileSourceUseCase } from "../../domain/ingestion/application/use-cases/reconcile-source.use-case.js";
import { RequestReplayUseCase } from "../../domain/ingestion/application/use-cases/request-replay.use-case.js";
import { ResolveRoutesUseCase } from "../../domain/ingestion/application/use-cases/resolve-routes.use-case.js";
import { ValidatePayloadUseCase } from "../../domain/ingestion/application/use-cases/validate-payload.use-case.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AlertController } from "../../interface/http/controllers/alert.controller.js";
import { BatchController } from "../../interface/http/controllers/batch.controller.js";
import { DlqController } from "../../interface/http/controllers/dlq.controller.js";
import { HealthController } from "../../interface/http/controllers/health.controller.js";
import { MetricsController } from "../../interface/http/controllers/metrics.controller.js";
import { ReplayController } from "../../interface/http/controllers/replay.controller.js";
import { RoutingController } from "../../interface/http/controllers/routing.controller.js";
import { SchemaController } from "../../interface/http/controllers/schema.controller.js";
import { SourceController } from "../../interface/http/controllers/source.controller.js";
import { TransformController } from "../../interface/http/controllers/transform.controller.js";
// Controllers
import { WebhookController } from "../../interface/http/controllers/webhook.controller.js";
// Config
import { createPrismaClient, createRedisConnection, env, logger } from "../config/index.js";
import { PrismaAlertRepository } from "../persistence/pg/alert.repository.js";
// Persistence
import { PrismaDeliveryRepository } from "../persistence/pg/delivery.repository.js";
import { PrismaEventRepository } from "../persistence/pg/event.repository.js";
import { PrismaReplayRepository } from "../persistence/pg/replay.repository.js";
import { PrismaRouteRepository } from "../persistence/pg/route.repository.js";
import { PrismaSchemaRepository } from "../persistence/pg/schema.repository.js";
import { PrismaSourceRepository } from "../persistence/pg/source.repository.js";
import { PrismaTransformRepository } from "../persistence/pg/transform.repository.js";
import { WebhookBuffer } from "../persistence/webhook-buffer.js";
// Queue Producers
import { BatchQueueProducer } from "../queue/producers/batch-queue.producer.js";
import { WebhookQueueProducer } from "../queue/producers/webhook-queue.producer.js";

export interface Cradle {
    // Config
    env: typeof env;
    logger: typeof logger;
    redis: Redis;
    prisma: PrismaClient;

    // Persistence
    eventRepository: PrismaEventRepository;
    schemaRepository: PrismaSchemaRepository;
    replayRepository: PrismaReplayRepository;
    alertRepository: PrismaAlertRepository;
    routeRepository: PrismaRouteRepository;
    deliveryRepository: PrismaDeliveryRepository;
    transformRepository: PrismaTransformRepository;
    sourceRepository: PrismaSourceRepository;
    webhookBuffer: WebhookBuffer;

    // Producers
    webhookQueueProducer: WebhookQueueProducer;
    batchQueueProducer: BatchQueueProducer;

    // Use Cases
    ingestWebhookUseCase: IngestWebhookUseCase;
    validatePayloadUseCase: ValidatePayloadUseCase;
    manageSchemaUseCase: ManageSchemaUseCase;
    requestReplayUseCase: RequestReplayUseCase;
    executeReplayUseCase: ExecuteReplayUseCase;
    processBatchChunkUseCase: ProcessBatchChunkUseCase;
    manageRouteUseCase: ManageRouteUseCase;
    resolveRoutesUseCase: ResolveRoutesUseCase;
    executeDeliveryUseCase: ExecuteDeliveryUseCase;
    applyTransformUseCase: ApplyTransformUseCase;
    manageSourceUseCase: ManageSourceUseCase;
    deduplicateEventUseCase: DeduplicateEventUseCase;
    reconcileSourceUseCase: ReconcileSourceUseCase;

    // Controllers
    webhookController: WebhookController;
    schemaController: SchemaController;
    replayController: ReplayController;
    metricsController: MetricsController;
    dlqController: DlqController;
    alertController: AlertController;
    batchController: BatchController;
    healthController: HealthController;
    routingController: RoutingController;
    transformController: TransformController;
    sourceController: SourceController;
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
        prisma: asFunction(createPrismaClient).singleton(),

        // Persistence - Singletons
        eventRepository: asFunction((cradle) => new PrismaEventRepository(cradle.prisma)).singleton(),
        schemaRepository: asFunction((cradle) => new PrismaSchemaRepository(cradle.prisma)).singleton(),
        replayRepository: asFunction((cradle) => new PrismaReplayRepository(cradle.prisma)).singleton(),
        alertRepository: asFunction((cradle) => new PrismaAlertRepository(cradle.prisma)).singleton(),
        routeRepository: asFunction((cradle) => new PrismaRouteRepository(cradle.prisma)).singleton(),
        deliveryRepository: asFunction((cradle) => new PrismaDeliveryRepository(cradle.prisma)).singleton(),
        transformRepository: asFunction((cradle) => new PrismaTransformRepository(cradle.prisma)).singleton(),
        sourceRepository: asFunction((cradle) => new PrismaSourceRepository(cradle.prisma)).singleton(),
        webhookBuffer: asFunction(
            (cradle) =>
                new WebhookBuffer(
                    {
                        eventRepository: cradle.eventRepository,
                        webhookQueueProducer: cradle.webhookQueueProducer,
                        logger: cradle.logger,
                    },
                    {
                        flushInterval: cradle.env.BUFFER_FLUSH_INTERVAL,
                        maxSize: cradle.env.BUFFER_MAX_SIZE,
                    },
                ),
        ).singleton(),

        // Queue Producers - Singletons
        webhookQueueProducer: asClass(WebhookQueueProducer)
            .singleton()
            .inject((container) => ({ connection: container.resolve("redis") }))
            .classic(),
        batchQueueProducer: asClass(BatchQueueProducer)
            .singleton()
            .inject((container) => ({ connection: container.resolve("redis") }))
            .classic(),

        // Use Cases - Transient
        ingestWebhookUseCase: asClass(IngestWebhookUseCase).transient(),
        validatePayloadUseCase: asClass(ValidatePayloadUseCase).transient(),
        manageSchemaUseCase: asClass(ManageSchemaUseCase).transient(),
        requestReplayUseCase: asClass(RequestReplayUseCase).transient(),
        executeReplayUseCase: asClass(ExecuteReplayUseCase).transient(),
        processBatchChunkUseCase: asClass(ProcessBatchChunkUseCase).transient(),
        manageRouteUseCase: asClass(ManageRouteUseCase).transient(),
        resolveRoutesUseCase: asClass(ResolveRoutesUseCase).transient(),
        executeDeliveryUseCase: asClass(ExecuteDeliveryUseCase).transient(),
        applyTransformUseCase: asClass(ApplyTransformUseCase).transient(),
        manageSourceUseCase: asClass(ManageSourceUseCase).transient(),
        deduplicateEventUseCase: asClass(DeduplicateEventUseCase).transient(),
        reconcileSourceUseCase: asClass(ReconcileSourceUseCase).transient(),

        // Controllers - Scoped
        webhookController: asClass(WebhookController).scoped(),
        schemaController: asClass(SchemaController).scoped(),
        replayController: asClass(ReplayController).scoped(),
        metricsController: asClass(MetricsController).scoped(),
        dlqController: asClass(DlqController).scoped(),
        alertController: asClass(AlertController).scoped(),
        batchController: asClass(BatchController).scoped(),
        healthController: asClass(HealthController).scoped(),
        routingController: asClass(RoutingController).scoped(),
        transformController: asClass(TransformController).scoped(),
        sourceController: asClass(SourceController).scoped(),
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
