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
