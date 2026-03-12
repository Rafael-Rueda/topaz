import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "./env.js";
import { logger } from "./logger.js";
import { PrismaClient } from "../../generated/prisma/client.js";

let prismaInstance: PrismaClient | null = null;
let poolInstance: Pool | null = null;

export function createPrismaClient(): PrismaClient {
    if (prismaInstance) return prismaInstance;

    poolInstance = new Pool({
        connectionString: env.DATABASE_URL,
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
