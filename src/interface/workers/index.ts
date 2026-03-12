import { Worker } from "bullmq";

import { ApplyTransformUseCase } from "../../domain/ingestion/application/use-cases/apply-transform.use-case.js";
import { ExecuteDeliveryUseCase } from "../../domain/ingestion/application/use-cases/execute-delivery.use-case.js";
import { ReconcileSourceUseCase } from "../../domain/ingestion/application/use-cases/reconcile-source.use-case.js";
import { ResolveRoutesUseCase } from "../../domain/ingestion/application/use-cases/resolve-routes.use-case.js";
import { env } from "../../infra/config/env.js";
import { createPrismaClient, createRedisConnection, disconnectPrisma, logger } from "../../infra/config/index.js";
import { AlertEvaluatorJob } from "../../infra/jobs/alert-evaluator.job.js";
import { ReconciliationJob } from "../../infra/jobs/reconciliation.job.js";
import { RecoveryJob } from "../../infra/jobs/recovery.job.js";
import { PrismaAlertRepository } from "../../infra/persistence/pg/alert.repository.js";
import { PrismaDeliveryRepository } from "../../infra/persistence/pg/delivery.repository.js";
import { PrismaEventRepository } from "../../infra/persistence/pg/event.repository.js";
import { PrismaRouteRepository } from "../../infra/persistence/pg/route.repository.js";
import { PrismaTransformRepository } from "../../infra/persistence/pg/transform.repository.js";
import { BatchWorker } from "../../infra/queue/consumers/batch.worker.js";
import { WebhookWorker } from "../../infra/queue/consumers/webhook.worker.js";
import { WebhookQueueProducer } from "../../infra/queue/producers/webhook-queue.producer.js";

async function main(): Promise<void> {
    logger.info("Starting Topaz workers...");

    const connection = createRedisConnection();
    const prisma = createPrismaClient();
    const eventRepository = new PrismaEventRepository(prisma);
    const alertRepository = new PrismaAlertRepository(prisma);
    const routeRepository = new PrismaRouteRepository(prisma);
    const deliveryRepository = new PrismaDeliveryRepository(prisma);
    const webhookQueueProducer = new WebhookQueueProducer(connection);

    const transformRepository = new PrismaTransformRepository(prisma);

    // Use Cases
    const resolveRoutesUseCase = new ResolveRoutesUseCase({ routeRepository });
    const executeDeliveryUseCase = new ExecuteDeliveryUseCase({ deliveryRepository, logger });
    const applyTransformUseCase = new ApplyTransformUseCase({ transformRepository, logger });

    // Workers
    const webhookWorker = new WebhookWorker({
        connection,
        logger,
        eventRepository,
        deliveryRepository,
        resolveRoutesUseCase,
        executeDeliveryUseCase,
        applyTransformUseCase,
    });
    const batchWorker = new BatchWorker({ connection, logger });

    webhookWorker.start();
    batchWorker.start();

    // Recovery Job — runs every 30s via BullMQ repeatable
    const recoveryJob = new RecoveryJob({ eventRepository, webhookQueueProducer, logger });

    const recoveryWorker = new Worker(
        "topaz-recovery",
        async () => {
            await recoveryJob.execute();
        },
        {
            connection,
            prefix: env.QUEUE_PREFIX,
            concurrency: 1,
        },
    );

    // Register the repeatable job
    const { Queue } = await import("bullmq");
    const recoveryQueue = new Queue("topaz-recovery", {
        connection,
        prefix: env.QUEUE_PREFIX,
    });

    await recoveryQueue.upsertJobScheduler("recovery-scheduler", {
        every: 30_000, // 30 seconds
    });

    recoveryWorker.on("error", (err) => {
        logger.error({ error: err.message }, "Recovery worker error");
    });

    // Alert Evaluator Job — runs every 30s via BullMQ repeatable
    const alertEvaluatorJob = new AlertEvaluatorJob({
        prisma,
        redis: connection,
        alertRepository,
        logger,
    });

    const alertWorker = new Worker(
        "topaz-alert-evaluator",
        async () => {
            await alertEvaluatorJob.execute();
        },
        {
            connection,
            prefix: env.QUEUE_PREFIX,
            concurrency: 1,
        },
    );

    const alertQueue = new Queue("topaz-alert-evaluator", {
        connection,
        prefix: env.QUEUE_PREFIX,
    });

    await alertQueue.upsertJobScheduler("alert-evaluator-scheduler", {
        every: 30_000, // 30 seconds
    });

    alertWorker.on("error", (err) => {
        logger.error({ error: err.message }, "Alert evaluator worker error");
    });

    // Reconciliation Job — runs every 5 minutes via BullMQ repeatable
    const reconcileSourceUseCase = new ReconcileSourceUseCase({
        eventRepository,
        webhookQueueProducer,
        logger,
    });

    // Reconcilers are registered here. Add more as needed.
    // The Stripe reconciler requires STRIPE_SECRET_KEY to be set in the environment.
    const reconcilers: import("../../domain/ingestion/application/interfaces/reconciler.interface.js").IReconciler[] =
        [];

    // Only register Stripe reconciler if API key is configured
    if (env.STRIPE_SECRET_KEY) {
        const { StripeReconciler } = await import("../../infra/reconcilers/stripe.reconciler.js");
        reconcilers.push(new StripeReconciler({ apiKey: env.STRIPE_SECRET_KEY }, logger));
    }

    const reconciliationJob = new ReconciliationJob({
        reconcileSourceUseCase,
        reconcilers,
        logger,
    });

    const reconciliationWorker = new Worker(
        "topaz-reconciliation",
        async () => {
            await reconciliationJob.execute();
        },
        {
            connection,
            prefix: env.QUEUE_PREFIX,
            concurrency: 1,
        },
    );

    const reconciliationQueue = new Queue("topaz-reconciliation", {
        connection,
        prefix: env.QUEUE_PREFIX,
    });

    await reconciliationQueue.upsertJobScheduler("reconciliation-scheduler", {
        every: 300_000, // 5 minutes
    });

    reconciliationWorker.on("error", (err) => {
        logger.error({ error: err.message }, "Reconciliation worker error");
    });

    logger.info("All workers started. Waiting for jobs...");

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
        logger.info({ signal }, "Shutdown signal received");

        await Promise.all([
            webhookWorker.stop(),
            batchWorker.stop(),
            recoveryWorker.close(),
            recoveryQueue.close(),
            alertWorker.close(),
            alertQueue.close(),
            reconciliationWorker.close(),
            reconciliationQueue.close(),
        ]);

        await webhookQueueProducer.close();
        await connection.quit();
        await disconnectPrisma();
        logger.info("Workers shutdown complete");
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
    logger.error({ error }, "Failed to start workers");
    process.exit(1);
});
