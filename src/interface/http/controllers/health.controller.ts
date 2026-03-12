import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";

export interface HealthControllerDeps {
    redis: Redis;
}

export class HealthController {
    constructor(private readonly deps: HealthControllerDeps) {}

    async check(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const redisStatus = this.deps.redis.status === "ready" ? "healthy" : "unhealthy";

        const isHealthy = redisStatus === "healthy";

        reply.status(isHealthy ? 200 : 503).send({
            status: isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
                redis: redisStatus,
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
