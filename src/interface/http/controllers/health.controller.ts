import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";

import type { PrismaClient } from "../../../generated/prisma/client.js";

export interface HealthControllerDeps {
    redis: Redis;
    prisma: PrismaClient;
}

export class HealthController {
    constructor(private readonly deps: HealthControllerDeps) {}

    async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const redisStatus = this.deps.redis.status === "ready" ? "healthy" : "unhealthy";

        let pgStatus = "unhealthy";
        try {
            await this.deps.prisma.$queryRaw`SELECT 1`;
            pgStatus = "healthy";
        } catch {
            pgStatus = "unhealthy";
        }

        const isHealthy = redisStatus === "healthy" && pgStatus === "healthy";

        reply.status(isHealthy ? 200 : 503).send({
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
                redis: redisStatus,
                postgres: pgStatus,
            },
        });
    }

    async readiness(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        reply.status(200).send({ status: "ready" });
    }

    async liveness(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        reply.status(200).send({ status: "alive" });
    }
}
