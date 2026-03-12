import axios from "axios";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

import type {
    AlertRuleProps,
    IAlertRepository,
} from "../../domain/ingestion/application/interfaces/alert-repository.interface.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { env } from "../config/env.js";
import type { Logger } from "../config/logger.js";
import { QUEUE_NAMES } from "../queue/queues.js";

export interface AlertEvaluatorDeps {
    prisma: PrismaClient;
    redis: Redis;
    alertRepository: IAlertRepository;
    logger: Logger;
}

/**
 * Alert Evaluator Job — evaluates active alert rules every 30s.
 * Fires webhook notifications when thresholds are exceeded.
 */
export class AlertEvaluatorJob {
    constructor(private readonly deps: AlertEvaluatorDeps) {}

    async execute(): Promise<void> {
        const rules = await this.deps.alertRepository.findActive();
        if (rules.length === 0) return;

        for (const rule of rules) {
            try {
                await this.evaluateRule(rule);
            } catch (err) {
                this.deps.logger.error({ error: (err as Error).message, ruleId: rule.id }, "Alert evaluation failed");
            }
        }
    }

    private async evaluateRule(rule: AlertRuleProps): Promise<void> {
        const metricValue = await this.getMetricValue(rule);

        if (metricValue <= rule.threshold) return;

        // Check cooldown
        const lastFired = await this.deps.alertRepository.findLastFired(rule.id);
        if (lastFired) {
            const cooldownMs = this.parseDuration(rule.cooldown);
            const elapsed = Date.now() - lastFired.firedAt.getTime();
            if (elapsed < cooldownMs) return;
        }

        // Fire alert
        const message = `[Topaz Alert] ${rule.name}: ${rule.metric} = ${metricValue} (threshold: ${rule.threshold})`;

        this.deps.logger.warn({ ruleId: rule.id, metricValue, threshold: rule.threshold }, message);

        try {
            await axios.post(
                rule.targetUrl,
                {
                    alert: rule.name,
                    metric: rule.metric,
                    value: metricValue,
                    threshold: rule.threshold,
                    message,
                    timestamp: new Date().toISOString(),
                },
                { timeout: 5000 },
            );
        } catch (err) {
            this.deps.logger.error(
                { error: (err as Error).message, targetUrl: rule.targetUrl },
                "Failed to send alert notification",
            );
        }

        await this.deps.alertRepository.createHistory(rule.id, metricValue, message);
    }

    private async getMetricValue(rule: AlertRuleProps): Promise<number> {
        const windowMs = this.parseDuration(rule.window);
        const since = new Date(Date.now() - windowMs);

        switch (rule.metric) {
            case "ERROR_RATE": {
                const total = await this.deps.prisma.event.count({ where: { createdAt: { gte: since } } });
                if (total === 0) return 0;
                const failed = await this.deps.prisma.event.count({
                    where: { createdAt: { gte: since }, status: { in: ["FAILED", "DEAD"] } },
                });
                return (failed / total) * 100;
            }
            case "QUEUE_SIZE": {
                const queue = new Queue(QUEUE_NAMES.WEBHOOK_INGEST, {
                    connection: this.deps.redis,
                    prefix: env.QUEUE_PREFIX,
                });
                try {
                    return await queue.getWaitingCount();
                } finally {
                    await queue.close();
                }
            }
            case "DLQ_SIZE": {
                return this.deps.prisma.event.count({ where: { status: "DEAD" } });
            }
            case "LATENCY_P95": {
                const events = await this.deps.prisma.event.findMany({
                    where: { status: "DELIVERED", processedAt: { not: null }, createdAt: { gte: since } },
                    select: { createdAt: true, processedAt: true },
                    orderBy: { processedAt: "desc" },
                    take: 500,
                });
                if (events.length === 0) return 0;
                const latencies = events
                    .filter((e) => e.processedAt)
                    .map((e) => e.processedAt!.getTime() - e.createdAt.getTime())
                    .sort((a, b) => a - b);
                return latencies[Math.floor(latencies.length * 0.95)] ?? 0;
            }
            case "SCHEMA_DRIFT": {
                return this.deps.prisma.event.count({
                    where: { createdAt: { gte: since }, validationStatus: "INVALID" },
                });
            }
            default:
                return 0;
        }
    }

    private parseDuration(duration: string): number {
        const match = duration.match(/^(\d+)(s|m|h|d)$/);
        if (!match) return 300_000; // default 5m

        const value = Number.parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case "s":
                return value * 1000;
            case "m":
                return value * 60_000;
            case "h":
                return value * 3_600_000;
            case "d":
                return value * 86_400_000;
            default:
                return 300_000;
        }
    }
}
