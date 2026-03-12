import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "./env.js";
import { logger } from "./logger.js";
import { PrismaClient } from "../../generated/prisma/client.js";

let prismaInstance: PrismaClient | null = null;
let poolInstance: Pool | null = null;

export function createPrismaClient(): PrismaClient {
    if (prismaInstance) return prismaInstance;

    // Pool configuration for high-load scenarios
    // See: https://node-postgres.com/features/pooling
    poolInstance = new Pool({
        connectionString: env.DATABASE_URL,
        max: env.DB_POOL_MAX ?? 20,              // Maximum number of clients in the pool
        min: env.DB_POOL_MIN ?? 5,               // Minimum number of clients in the pool
        idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT ?? 30000, // Close idle clients after 30s
        connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT ?? 5000, // Timeout for new connections
    });

    // @prisma/adapter-pg bundles its own @types/pg which is structurally incompatible
    const adapter = new PrismaPg(poolInstance as unknown as ConstructorParameters<typeof PrismaPg>[0]);

    prismaInstance = new PrismaClient({ adapter });

    logger.info("Prisma client created");
    return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
    if (poolInstance) {
        await poolInstance.end();
        poolInstance = null;
    }
    logger.info("Prisma client disconnected");
}
