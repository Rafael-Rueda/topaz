import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3333),
    HOST: z.string().default("0.0.0.0"),

    // Redis
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Queue
    QUEUE_PREFIX: z.string().default("topaz"),

    // Webhook Auth
    WEBHOOK_SECRET_KEY: z.string().optional(),

    // Batch Processing
    BATCH_CHUNK_SIZE: z.coerce.number().default(500),

    // Database
    DATABASE_URL: z.string(),
    DB_POOL_MAX: z.coerce.number().default(20),
    DB_POOL_MIN: z.coerce.number().default(5),
    DB_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),
    DB_POOL_CONNECTION_TIMEOUT: z.coerce.number().default(5000),

    // Buffer (micro-batch)
    BUFFER_FLUSH_INTERVAL: z.coerce.number().default(50),
    BUFFER_MAX_SIZE: z.coerce.number().default(500),

    // Reconciliation
    STRIPE_SECRET_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error("Invalid environment variables:", result.error.flatten());
        process.exit(1);
    }

    return result.data;
}

export const env = loadEnv();
