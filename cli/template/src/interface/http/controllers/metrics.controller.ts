import { Queue } from "bullmq";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";

import type { PrismaClient } from "../../../generated/prisma/client.js";
import { env } from "../../../infra/config/env.js";
import { QUEUE_NAMES } from "../../../infra/queue/queues.js";

export interface MetricsControllerDeps {
    prisma: PrismaClient;
    redis: Redis;
}

export class MetricsController {
    constructor(private readonly deps: MetricsControllerDeps) {}

    async overview(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const [throughput, statusCounts, recentErrors, queueStats] = await Promise.all([
            this.getThroughput().catch(() => ({ total: 0, perSecond: 0, bySources: {} })),
            this.getStatusCounts().catch(() => ({})),
            this.getRecentErrors().catch(() => []),
            this.getQueueStats().catch(() => ({ webhookIngest: { waiting: 0, active: 0, delayed: 0, failed: 0 } })),
        ]);

        const queue = queueStats.webhookIngest ?? { waiting: 0, active: 0, delayed: 0, failed: 0 };

        reply.send({
            throughput,
            statusCounts,
            recentErrors,
            queueStats: queue,
            timestamp: new Date().toISOString(),
        });
    }

    async throughput(
        request: FastifyRequest<{ Querystring: { minutes?: number } }>,
        reply: FastifyReply,
    ): Promise<void> {
        const minutes = request.query.minutes ?? 60;
        const data = await this.getThroughputBySource(minutes);
        reply.send({ data, window: `${minutes}m` });
    }

    async latency(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const data = await this.getLatencyStats();
        reply.send({ data });
    }

    async errors(request: FastifyRequest<{ Querystring: { minutes?: number } }>, reply: FastifyReply): Promise<void> {
        const minutes = request.query.minutes ?? 60;
        const data = await this.getErrorStats(minutes);
        reply.send({ data, window: `${minutes}m` });
    }

    async queues(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const data = await this.getQueueStats();
        reply.send({ data });
    }

    async dlqSummary(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const data = await this.getDlqSummary();
        reply.send({ data });
    }

    // -- Private helpers --

    private async getThroughput() {
        const since = new Date(Date.now() - 60_000); // last minute
        const [total, recentCount, bySource] = await Promise.all([
            this.deps.prisma.event.count(),
            this.deps.prisma.event.count({
                where: { createdAt: { gte: since } },
            }),
            this.deps.prisma.event.groupBy({
                by: ["source"],
                _count: true,
            }),
        ]);

        const bySources: Record<string, number> = {};
        for (const r of bySource) {
            bySources[r.source] = r._count;
        }

        return {
            total,
            perSecond: Math.round((recentCount / 60) * 100) / 100,
            bySources,
        };
    }

    private async getThroughputBySource(minutes: number) {
        const since = new Date(Date.now() - minutes * 60_000);
        const results = await this.deps.prisma.event.groupBy({
            by: ["source"],
            where: { createdAt: { gte: since } },
            _count: true,
        });
        return results.map((r) => ({
            source: r.source,
            total: r._count,
            perSecond: Math.round((r._count / (minutes * 60)) * 100) / 100,
        }));
    }

    private async getStatusCounts() {
        const results = await this.deps.prisma.event.groupBy({
            by: ["status"],
            _count: true,
        });
        return Object.fromEntries(results.map((r) => [r.status, r._count]));
    }

    private async getRecentErrors() {
        const events = await this.deps.prisma.event.findMany({
            where: { status: { in: ["FAILED", "DEAD"] } },
            select: { id: true, source: true, eventType: true, lastError: true, createdAt: true, failedAt: true },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
        return events;
    }

    private async getLatencyStats() {
        const delivered = await this.deps.prisma.event.findMany({
            where: { status: "DELIVERED", processedAt: { not: null } },
            select: { createdAt: true, processedAt: true, source: true },
            orderBy: { processedAt: "desc" },
            take: 1000,
        });

        const bySource = new Map<string, number[]>();
        for (const e of delivered) {
            if (!e.processedAt) continue;
            const latency = e.processedAt.getTime() - e.createdAt.getTime();
            const list = bySource.get(e.source) ?? [];
            list.push(latency);
            bySource.set(e.source, list);
        }

        return Array.from(bySource.entries()).map(([source, latencies]) => {
            latencies.sort((a, b) => a - b);
            return {
                source,
                count: latencies.length,
                avgMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
                p50Ms: latencies[Math.floor(latencies.length * 0.5)] ?? 0,
                p95Ms: latencies[Math.floor(latencies.length * 0.95)] ?? 0,
                p99Ms: latencies[Math.floor(latencies.length * 0.99)] ?? 0,
            };
        });
    }

    private async getErrorStats(minutes: number) {
        const since = new Date(Date.now() - minutes * 60_000);
        const total = await this.deps.prisma.event.count({
            where: { createdAt: { gte: since } },
        });
        const failed = await this.deps.prisma.event.count({
            where: { createdAt: { gte: since }, status: { in: ["FAILED", "DEAD"] } },
        });

        const bySource = await this.deps.prisma.event.groupBy({
            by: ["source"],
            where: { createdAt: { gte: since }, status: { in: ["FAILED", "DEAD"] } },
            _count: true,
        });

        return {
            total,
            failed,
            errorRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
            bySource: bySource.map((r) => ({ source: r.source, count: r._count })),
        };
    }

    private async getQueueStats() {
        const queue = new Queue(QUEUE_NAMES.WEBHOOK_INGEST, {
            connection: this.deps.redis,
            prefix: env.QUEUE_PREFIX,
        });

        try {
            const [waiting, active, delayed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getDelayedCount(),
                queue.getFailedCount(),
            ]);

            return {
                webhookIngest: { waiting, active, delayed, failed },
            };
        } finally {
            await queue.close();
        }
    }

    private async getDlqSummary() {
        const bySource = await this.deps.prisma.event.groupBy({
            by: ["source"],
            where: { status: "DEAD" },
            _count: true,
        });

        const byError = await this.deps.prisma.event.groupBy({
            by: ["lastError"],
            where: { status: "DEAD" },
            _count: true,
            orderBy: { _count: { lastError: "desc" } },
            take: 10,
        });

        const total = bySource.reduce((sum, r) => sum + r._count, 0);

        return {
            total,
            bySource: bySource.map((r) => ({ source: r.source, count: r._count })),
            byError: byError.map((r) => ({ error: r.lastError ?? "unknown", count: r._count })),
        };
    }
}
