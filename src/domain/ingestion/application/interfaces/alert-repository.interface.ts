import type { AlertMetric } from "../../../../generated/prisma/client.js";

export interface AlertRuleProps {
    id: string;
    name: string;
    metric: AlertMetric;
    threshold: number;
    window: string;
    targetUrl: string;
    cooldown: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AlertHistoryProps {
    id: string;
    alertRuleId: string;
    metricValue: number;
    message: string;
    firedAt: Date;
}

export interface CreateAlertInput {
    name: string;
    metric: AlertMetric;
    threshold: number;
    window: string;
    targetUrl: string;
    cooldown?: string;
}

export interface UpdateAlertInput {
    name?: string;
    threshold?: number;
    window?: string;
    targetUrl?: string;
    cooldown?: string;
    active?: boolean;
}

export interface IAlertRepository {
    create(input: CreateAlertInput): Promise<AlertRuleProps>;
    findById(id: string): Promise<AlertRuleProps | null>;
    findAll(): Promise<AlertRuleProps[]>;
    findActive(): Promise<AlertRuleProps[]>;
    update(id: string, input: UpdateAlertInput): Promise<AlertRuleProps>;
    deactivate(id: string): Promise<void>;
    delete(id: string): Promise<void>;
    createHistory(alertRuleId: string, metricValue: number, message: string): Promise<AlertHistoryProps>;
    findHistory(alertRuleId?: string, limit?: number): Promise<AlertHistoryProps[]>;
    findLastFired(alertRuleId: string): Promise<AlertHistoryProps | null>;
}
