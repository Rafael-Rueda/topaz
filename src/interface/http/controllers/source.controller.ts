import type { FastifyReply, FastifyRequest } from "fastify";

import type { ManageSourceUseCase } from "../../../domain/ingestion/application/use-cases/manage-source.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface CreateSourceBody {
    name: string;
    signatureHeader?: string;
    signatureSecret?: string;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512";
    dedupField?: string;
    dedupWindow?: string;
    rateLimitMax?: number;
    rateLimitWindow?: number;
}

interface UpdateSourceBody {
    signatureHeader?: string | null;
    signatureSecret?: string | null;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512" | null;
    dedupField?: string | null;
    dedupWindow?: string | null;
    rateLimitMax?: number | null;
    rateLimitWindow?: number | null;
    active?: boolean;
}

interface SourceIdParams {
    id: string;
}

interface SourceNameParams {
    name: string;
}

export interface SourceControllerDeps {
    manageSourceUseCase: ManageSourceUseCase;
    logger: Logger;
}

export class SourceController {
    constructor(private readonly deps: SourceControllerDeps) {}

    async create(request: FastifyRequest<{ Body: CreateSourceBody }>, reply: FastifyReply): Promise<void> {
        const { name } = request.body;

        this.deps.logger.debug({ name }, "Creating source");

        const existing = await this.deps.manageSourceUseCase.findByName(name);
        if (existing) {
            reply.status(409).send({ error: "Source with this name already exists", statusCode: 409 });
            return;
        }

        const result = await this.deps.manageSourceUseCase.create(request.body);

        this.deps.logger.info({ id: result.id, name }, "Source created");

        reply.status(201).send(result);
    }

    async findAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const sources = await this.deps.manageSourceUseCase.findAll();
        reply.send({ data: sources, total: sources.length });
    }

    async findActive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const sources = await this.deps.manageSourceUseCase.findActive();
        reply.send({ data: sources, total: sources.length });
    }

    async findById(request: FastifyRequest<{ Params: SourceIdParams }>, reply: FastifyReply): Promise<void> {
        const source = await this.deps.manageSourceUseCase.findById(request.params.id);

        if (!source) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        reply.send(source);
    }

    async findByName(request: FastifyRequest<{ Params: SourceNameParams }>, reply: FastifyReply): Promise<void> {
        const source = await this.deps.manageSourceUseCase.findByName(request.params.name);

        if (!source) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        reply.send(source);
    }

    async update(
        request: FastifyRequest<{ Params: SourceIdParams; Body: UpdateSourceBody }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSourceUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        const result = await this.deps.manageSourceUseCase.update(id, request.body);

        this.deps.logger.info({ id }, "Source updated");

        reply.send(result);
    }

    async deactivate(request: FastifyRequest<{ Params: SourceIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSourceUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        await this.deps.manageSourceUseCase.deactivate(id);

        this.deps.logger.info({ id }, "Source deactivated");

        reply.status(204).send();
    }

    async activate(request: FastifyRequest<{ Params: SourceIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSourceUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        await this.deps.manageSourceUseCase.activate(id);

        this.deps.logger.info({ id }, "Source activated");

        reply.status(204).send();
    }

    async destroy(request: FastifyRequest<{ Params: SourceIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSourceUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Source not found", statusCode: 404 });
            return;
        }

        await this.deps.manageSourceUseCase.delete(id);

        this.deps.logger.info({ id, name: existing.name }, "Source permanently deleted");

        reply.status(204).send();
    }
}
