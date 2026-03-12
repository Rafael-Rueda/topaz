import type { FastifyReply, FastifyRequest } from "fastify";

import type { IAlertRepository } from "../../../domain/ingestion/application/interfaces/alert-repository.interface.js";
import type { AlertMetric } from "../../../generated/prisma/client.js";
import type { Logger } from "../../../infra/config/logger.js";

interface CreateAlertBody {
    name: string;
    metric: AlertMetric;
    threshold: number;
    window: string;
    targetUrl: string;
    cooldown?: string;
}

interface UpdateAlertBody {
    name?: string;
    threshold?: number;
    window?: string;
    targetUrl?: string;
    cooldown?: string;
    active?: boolean;
}

export interface AlertControllerDeps {
    alertRepository: IAlertRepository;
    logger: Logger;
}

export class AlertController {
    constructor(private readonly deps: AlertControllerDeps) {}

    async create(request: FastifyRequest<{ Body: CreateAlertBody }>, reply: FastifyReply): Promise<void> {
        const rule = await this.deps.alertRepository.create(request.body);
        this.deps.logger.info({ id: rule.id, name: rule.name }, "Alert rule created");
        reply.status(201).send(rule);
    }

    async findAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const rules = await this.deps.alertRepository.findAll();
        reply.send({ data: rules, total: rules.length });
    }

    async update(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateAlertBody }>,
        reply: FastifyReply,
    ): Promise<void> {
        const existing = await this.deps.alertRepository.findById(request.params.id);
        if (!existing) {
            reply.status(404).send({ error: "Alert rule not found", statusCode: 404 });
            return;
        }

        const rule = await this.deps.alertRepository.update(request.params.id, request.body);
        this.deps.logger.info({ id: rule.id, name: rule.name }, "Alert rule updated");
        reply.send(rule);
    }

    async deactivate(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
        const existing = await this.deps.alertRepository.findById(request.params.id);
        if (!existing) {
            reply.status(404).send({ error: "Alert rule not found", statusCode: 404 });
            return;
        }

        await this.deps.alertRepository.deactivate(request.params.id);
        this.deps.logger.info({ id: request.params.id }, "Alert rule deactivated");
        reply.status(204).send();
    }

    async history(
        request: FastifyRequest<{ Querystring: { alertRuleId?: string; limit?: number } }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { alertRuleId, limit } = request.query;
        const items = await this.deps.alertRepository.findHistory(alertRuleId, limit);
        reply.send({ data: items, total: items.length });
    }
}
