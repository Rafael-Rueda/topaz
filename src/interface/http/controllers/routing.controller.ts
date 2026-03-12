import type { FastifyReply, FastifyRequest } from "fastify";

import type { ManageRouteUseCase } from "../../../domain/ingestion/application/use-cases/manage-route.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface CreateRouteBody {
    source: string;
    eventType?: string;
    targetUrl: string;
    targetName: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
}

interface UpdateRouteBody {
    targetUrl?: string;
    targetName?: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
    active?: boolean;
}

interface RouteIdParams {
    id: string;
}

interface SourceParams {
    source: string;
}

export interface RoutingControllerDeps {
    manageRouteUseCase: ManageRouteUseCase;
    logger: Logger;
}

export class RoutingController {
    constructor(private readonly deps: RoutingControllerDeps) {}

    async create(request: FastifyRequest<{ Body: CreateRouteBody }>, reply: FastifyReply): Promise<void> {
        const {
            source,
            eventType,
            targetUrl,
            targetName,
            method,
            timeout,
            retryCount,
            retryBackoff,
            priority,
            headers,
        } = request.body;

        this.deps.logger.debug({ source, eventType, targetUrl }, "Creating route");

        const result = await this.deps.manageRouteUseCase.create({
            source,
            eventType,
            targetUrl,
            targetName,
            method,
            timeout,
            retryCount,
            retryBackoff,
            priority,
            headers,
        });

        this.deps.logger.info({ id: result.id, source, targetName }, "Route created");

        reply.status(201).send(result);
    }

    async findAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const routes = await this.deps.manageRouteUseCase.findAll();
        reply.send({ data: routes, total: routes.length });
    }

    async findBySource(request: FastifyRequest<{ Params: SourceParams }>, reply: FastifyReply): Promise<void> {
        const routes = await this.deps.manageRouteUseCase.findBySource(request.params.source);
        reply.send({ data: routes, total: routes.length });
    }

    async findById(request: FastifyRequest<{ Params: RouteIdParams }>, reply: FastifyReply): Promise<void> {
        const route = await this.deps.manageRouteUseCase.findById(request.params.id);

        if (!route) {
            reply.status(404).send({ error: "Route not found", statusCode: 404 });
            return;
        }

        reply.send(route);
    }

    async update(
        request: FastifyRequest<{ Params: RouteIdParams; Body: UpdateRouteBody }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageRouteUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Route not found", statusCode: 404 });
            return;
        }

        const result = await this.deps.manageRouteUseCase.update(id, request.body);

        this.deps.logger.info({ id }, "Route updated");

        reply.send(result);
    }

    async deactivate(request: FastifyRequest<{ Params: RouteIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageRouteUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Route not found", statusCode: 404 });
            return;
        }

        await this.deps.manageRouteUseCase.deactivate(id);

        this.deps.logger.info({ id }, "Route deactivated");

        reply.status(204).send();
    }

    async activate(request: FastifyRequest<{ Params: RouteIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageRouteUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Route not found", statusCode: 404 });
            return;
        }

        await this.deps.manageRouteUseCase.activate(id);

        this.deps.logger.info({ id }, "Route activated");

        reply.status(204).send();
    }

    async destroy(request: FastifyRequest<{ Params: RouteIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageRouteUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Route not found", statusCode: 404 });
            return;
        }

        await this.deps.manageRouteUseCase.delete(id);

        this.deps.logger.info({ id, source: existing.source }, "Route permanently deleted");

        reply.status(204).send();
    }
}
