import { z } from "zod";

export const WebhookParamsSchema = z.object({
    source: z.string().min(1).max(100),
});

export const WebhookResponseSchema = z.object({
    status: z.literal("accepted"),
    jobId: z.string(),
    message: z.string(),
});

export type WebhookParams = z.infer<typeof WebhookParamsSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
