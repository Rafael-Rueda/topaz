import { z } from "zod";

export const BatchResponseSchema = z.object({
    status: z.literal("accepted"),
    batchId: z.string(),
    stats: z.object({
        totalRows: z.number(),
        chunksQueued: z.number(),
    }),
    message: z.string(),
});

export const BatchErrorSchema = z.object({
    error: z.string(),
    batchId: z.string().optional(),
    message: z.string(),
});

export type BatchResponse = z.infer<typeof BatchResponseSchema>;
export type BatchError = z.infer<typeof BatchErrorSchema>;
