import { Redis } from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

export function createRedisConnection(): Redis {
    const connection = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    connection.on("connect", () => {
        logger.info("Redis connected");
    });

    connection.on("error", (err) => {
        logger.error({ err }, "Redis connection error");
    });

    return connection;
}

export type RedisConnection = Redis;
