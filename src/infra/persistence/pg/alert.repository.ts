import type {
    AlertHistoryProps,
    AlertRuleProps,
    CreateAlertInput,
    IAlertRepository,
    UpdateAlertInput,
} from "../../../domain/ingestion/application/interfaces/alert-repository.interface.js";
import type { AlertHistory, AlertRule, PrismaClient } from "../../../generated/prisma/client.js";

export class PrismaAlertRepository implements IAlertRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateAlertInput): Promise<AlertRuleProps> {
        const rule = await this.prisma.alertRule.create({
            data: {
                name: input.name,
                metric: input.metric,
                threshold: input.threshold,
                window: input.window,
                targetUrl: input.targetUrl,
                cooldown: input.cooldown ?? "5m",
            },
        });
        return this.toRuleProps(rule);
    }

    async findById(id: string): Promise<AlertRuleProps | null> {
        const rule = await this.prisma.alertRule.findUnique({ where: { id } });
        return rule ? this.toRuleProps(rule) : null;
    }

    async findAll(): Promise<AlertRuleProps[]> {
        const rules = await this.prisma.alertRule.findMany({ orderBy: { createdAt: "desc" } });
        return rules.map((r) => this.toRuleProps(r));
    }

    async findActive(): Promise<AlertRuleProps[]> {
        const rules = await this.prisma.alertRule.findMany({
            where: { active: true },
            orderBy: { createdAt: "desc" },
        });
        return rules.map((r) => this.toRuleProps(r));
    }

    async update(id: string, input: UpdateAlertInput): Promise<AlertRuleProps> {
        const rule = await this.prisma.alertRule.update({
            where: { id },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.threshold !== undefined && { threshold: input.threshold }),
                ...(input.window !== undefined && { window: input.window }),
                ...(input.targetUrl !== undefined && { targetUrl: input.targetUrl }),
                ...(input.cooldown !== undefined && { cooldown: input.cooldown }),
                ...(input.active !== undefined && { active: input.active }),
            },
        });
        return this.toRuleProps(rule);
    }

    async deactivate(id: string): Promise<void> {
        await this.prisma.alertRule.update({ where: { id }, data: { active: false } });
    }

    async createHistory(alertRuleId: string, metricValue: number, message: string): Promise<AlertHistoryProps> {
        const history = await this.prisma.alertHistory.create({
            data: { alertRuleId, metricValue, message },
        });
        return this.toHistoryProps(history);
    }

    async findHistory(alertRuleId?: string, limit = 50): Promise<AlertHistoryProps[]> {
        const items = await this.prisma.alertHistory.findMany({
            where: alertRuleId ? { alertRuleId } : undefined,
            take: limit,
            orderBy: { firedAt: "desc" },
        });
        return items.map((h) => this.toHistoryProps(h));
    }

    async findLastFired(alertRuleId: string): Promise<AlertHistoryProps | null> {
        const item = await this.prisma.alertHistory.findFirst({
            where: { alertRuleId },
            orderBy: { firedAt: "desc" },
        });
        return item ? this.toHistoryProps(item) : null;
    }

    private toRuleProps(rule: AlertRule): AlertRuleProps {
        return {
            id: rule.id,
            name: rule.name,
            metric: rule.metric,
            threshold: rule.threshold,
            window: rule.window,
            targetUrl: rule.targetUrl,
            cooldown: rule.cooldown,
            active: rule.active,
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
        };
    }

    private toHistoryProps(h: AlertHistory): AlertHistoryProps {
        return {
            id: h.id,
            alertRuleId: h.alertRuleId,
            metricValue: h.metricValue,
            message: h.message,
            firedAt: h.firedAt,
        };
    }
}
