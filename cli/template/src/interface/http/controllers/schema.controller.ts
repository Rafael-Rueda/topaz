import type { FastifyReply, FastifyRequest } from "fastify";

import type { ManageSchemaUseCase } from "../../../domain/ingestion/application/use-cases/manage-schema.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface SchemaIdParams {
    id: string;
}

interface SchemaSourceParams {
    source: string;
    eventType: string;
}

interface CreateSchemaBody {
    source: string;
    eventType: string;
    schema: object;
    rejectOnFail?: boolean;
}

interface UpdateSchemaBody {
    schema?: object;
    rejectOnFail?: boolean;
    active?: boolean;
}

export interface SchemaControllerDeps {
    manageSchemaUseCase: ManageSchemaUseCase;
    logger: Logger;
}

export class SchemaController {
    constructor(private readonly deps: SchemaControllerDeps) {}

    async create(request: FastifyRequest<{ Body: CreateSchemaBody }>, reply: FastifyReply): Promise<void> {
        const { source, eventType, schema, rejectOnFail } = request.body;

        this.deps.logger.debug({ source, eventType }, "Creating schema definition");

        const result = await this.deps.manageSchemaUseCase.create({
            source,
            eventType,
            schema,
            rejectOnFail,
        });

        this.deps.logger.info({ id: result.id, source, eventType, version: result.version }, "Schema created");

        reply.status(201).send(result);
    }

    async findAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const schemas = await this.deps.manageSchemaUseCase.findAll();
        reply.send({ data: schemas, total: schemas.length });
    }

    async findBySource(request: FastifyRequest<{ Params: { source: string } }>, reply: FastifyReply): Promise<void> {
        const schemas = await this.deps.manageSchemaUseCase.findAllBySource(request.params.source);
        reply.send({ data: schemas, total: schemas.length });
    }

    async findActive(request: FastifyRequest<{ Params: SchemaSourceParams }>, reply: FastifyReply): Promise<void> {
        const { source, eventType } = request.params;
        const schema = await this.deps.manageSchemaUseCase.findActive(source, eventType);

        if (!schema) {
            reply.status(404).send({ error: "Schema not found", statusCode: 404 });
            return;
        }

        reply.send(schema);
    }

    async update(
        request: FastifyRequest<{ Params: SchemaIdParams; Body: UpdateSchemaBody }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSchemaUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Schema not found", statusCode: 404 });
            return;
        }

        const result = await this.deps.manageSchemaUseCase.update(id, request.body);

        this.deps.logger.info({ id, source: result.source, eventType: result.eventType }, "Schema updated");

        reply.send(result);
    }

    async deactivate(request: FastifyRequest<{ Params: SchemaIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSchemaUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Schema not found", statusCode: 404 });
            return;
        }

        await this.deps.manageSchemaUseCase.deactivate(id);

        this.deps.logger.info({ id }, "Schema deactivated");

        reply.status(204).send();
    }

    async destroy(request: FastifyRequest<{ Params: SchemaIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.manageSchemaUseCase.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Schema not found", statusCode: 404 });
            return;
        }

        await this.deps.manageSchemaUseCase.delete(id);

        this.deps.logger.info(
            { id, source: existing.source, eventType: existing.eventType },
            "Schema permanently deleted",
        );

        reply.status(204).send();
    }
}
