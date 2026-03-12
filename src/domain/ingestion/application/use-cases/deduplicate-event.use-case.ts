import type { Redis } from "ioredis";

import type { Logger } from "../../../../infra/config/logger.js";
import type { ISourceRepository } from "../interfaces/source-repository.interface.js";

export interface DeduplicateResult {
    isDuplicate: boolean;
    externalId: string | null;
}

export interface DeduplicateEventDeps {
    redis: Redis;
    sourceRepository: ISourceRepository;
    logger: Logger;
}

/**
 * Deduplicates incoming webhook events using a two-layer strategy:
 *
 * 1. **Redis (hot)** — SET with TTL for fast lookup.
 *    Key: `dedup:{source}:{externalId}`. If the key exists, the event is a duplicate.
 *
 * 2. **Postgres (cold)** — unique index on (source, external_id) as a safety net.
 *    If Redis misses it, Postgres catches it via constraint violation.
 *
 * The dedup field and window are configured per source in the `sources` table.
 */
export class DeduplicateEventUseCase {
    constructor(private readonly deps: DeduplicateEventDeps) {}

    /**
     * Checks if this event is a duplicate and returns the extracted external ID.
     * If deduplication is not configured for the source, returns isDuplicate=false.
     */
    async execute(source: string, payload: unknown): Promise<DeduplicateResult> {
        const sourceConfig = await this.deps.sourceRepository.findByName(source);

        // No source config or no dedup configured — skip dedup
        if (!sourceConfig || !sourceConfig.dedupField) {
            return { isDuplicate: false, externalId: null };
        }

        const externalId = this.extractField(payload, sourceConfig.dedupField);

        if (!externalId) {
            this.deps.logger.debug(
                { source, dedupField: sourceConfig.dedupField },
                "Dedup field not found in payload — skipping dedup",
            );
            return { isDuplicate: false, externalId: null };
        }

        const dedupKey = `dedup:${source}:${externalId}`;
        const windowSeconds = this.parseWindow(sourceConfig.dedupWindow ?? "72h");

        // Check Redis — fast path
        const exists = await this.deps.redis.exists(dedupKey);

        if (exists) {
            this.deps.logger.info({ source, externalId }, "Duplicate event detected (Redis hot path)");
            return { isDuplicate: true, externalId };
        }

        // Not a duplicate — mark it in Redis with TTL
        await this.deps.redis.set(dedupKey, "1", "EX", windowSeconds);

        return { isDuplicate: false, externalId };
    }

    /**
     * Extracts a value from a nested object using dot-path notation.
     * e.g. "data.object.id" extracts obj.data.object.id
     */
    private extractField(payload: unknown, fieldPath: string): string | null {
        if (!payload || typeof payload !== "object") return null;

        const parts = fieldPath.split(".");
        let current: unknown = payload;

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== "object") {
                return null;
            }
            current = (current as Record<string, unknown>)[part];
        }

        if (current === null || current === undefined) return null;

        return String(current);
    }

    /**
     * Parses a human-readable duration string into seconds.
     * Supports: "72h", "30m", "3600s", "2d"
     */
    private parseWindow(window: string): number {
        const match = window.match(/^(\d+)([smhd])$/);
        if (!match) return 259200; // Default: 72h in seconds

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case "s":
                return value;
            case "m":
                return value * 60;
            case "h":
                return value * 3600;
            case "d":
                return value * 86400;
            default:
                return 259200;
        }
    }
}
