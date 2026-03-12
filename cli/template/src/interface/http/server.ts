import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyError } from "fastify";

import { registerRoutes } from "./routes/index.js";
import { disconnectPrisma, env, logger } from "../../infra/config/index.js";
import { createAppContainer, disposeContainer } from "../../infra/di/container.js";

async function buildServer() {
    const app = Fastify({
        logger: false,
        trustProxy: true,
        bodyLimit: 1048576, // 1MB for JSON bodies
    });

    // Security plugins
    await app.register(cors, {
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    await app.register(helmet, {
        contentSecurityPolicy: false,
    });

    // Multipart for file uploads (streaming)
    await app.register(multipart, {
        limits: {
            fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size
            files: 1,
        },
    });

    // Error handler
    app.setErrorHandler((error: FastifyError, request, reply) => {
        logger.error(
            {
                error: error.message,
                stack: error.stack,
                url: request.url,
                method: request.method,
            },
            "Request error",
        );

        const statusCode = error.statusCode ?? 500;

        reply.status(statusCode).send({
            error: statusCode >= 500 ? "Internal Server Error" : error.message,
            statusCode,
        });
    });

    return app;
}

async function main(): Promise<void> {
    logger.info("Starting Topaz server...");
    logger.info({ motto: "Stabilize the flux. Protect the Core." }, "Topaz Ingestion Unit");

    const container = createAppContainer();
    const app = await buildServer();

    // Register all routes with DI container
    await registerRoutes(app, container);

    // Routes registered
    logger.debug("Routes registered");

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
        logger.info({ signal }, "Shutdown signal received");

        // Flush pending buffer before closing
        const webhookBuffer = container.resolve("webhookBuffer");
        await webhookBuffer.shutdown();

        await app.close();
        await disconnectPrisma();
        await disposeContainer();

        logger.info("Server shutdown complete");
        process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Start server
    try {
        await app.listen({
            port: env.PORT,
            host: env.HOST,
        });

        logger.info({ port: env.PORT, host: env.HOST, env: env.NODE_ENV }, "Topaz server started");
    } catch (error) {
        logger.error({ error }, "Failed to start server");
        process.exit(1);
    }
}

main();
