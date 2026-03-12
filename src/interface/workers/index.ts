import { createRedisConnection, logger } from "../../infra/config/index.js";
import { BatchWorker } from "../../infra/queue/consumers/batch.worker.js";
import { WebhookWorker } from "../../infra/queue/consumers/webhook.worker.js";

async function main(): Promise<void> {
    logger.info("Starting Topaz workers...");

    const connection = createRedisConnection();

    const webhookWorker = new WebhookWorker({ connection, logger });
    const batchWorker = new BatchWorker({ connection, logger });

    webhookWorker.start();
    batchWorker.start();

    logger.info("All workers started. Waiting for jobs...");

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
        logger.info({ signal }, "Shutdown signal received");

        await Promise.all([webhookWorker.stop(), batchWorker.stop()]);

        await connection.quit();
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
