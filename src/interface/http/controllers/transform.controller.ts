import type { FastifyReply, FastifyRequest } from "fastify";

import type { ITransformRepository } from "../../../domain/ingestion/application/interfaces/transform-repository.interface.js";
import type { ApplyTransformUseCase } from "../../../domain/ingestion/application/use-cases/apply-transform.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface CreateTransformBody {
    source: string;
    eventType: string;
    mapping: Record<string, string>;
}

interface UpdateTransformBody {
    mapping?: Record<string, string>;
    active?: boolean;
}

interface TransformIdParams {
    id: string;
}

interface SourceParams {
    source: string;
}

interface TestTransformBody {
    source: string;
    eventType: string;
    payload: unknown;
}

export interface TransformControllerDeps {
    transformRepository: ITransformRepository;
    applyTransformUseCase: ApplyTransformUseCase;
    logger: Logger;
}

export class TransformController {
    constructor(private readonly deps: TransformControllerDeps) {}

    async create(request: FastifyRequest<{ Body: CreateTransformBody }>, reply: FastifyReply): Promise<void> {
        const { source, eventType, mapping } = request.body;

        this.deps.logger.debug({ source, eventType }, "Creating transform");

        const result = await this.deps.transformRepository.create({ source, eventType, mapping });

        this.deps.logger.info({ id: result.id, source, eventType }, "Transform created");

        reply.status(201).send(result);
    }

    async findAll(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const transforms = await this.deps.transformRepository.findAll();
        reply.send({ data: transforms, total: transforms.length });
    }

    async findBySource(request: FastifyRequest<{ Params: SourceParams }>, reply: FastifyReply): Promise<void> {
        const transforms = await this.deps.transformRepository.findBySource(request.params.source);
        reply.send({ data: transforms, total: transforms.length });
    }

    async findById(request: FastifyRequest<{ Params: TransformIdParams }>, reply: FastifyReply): Promise<void> {
        const transform = await this.deps.transformRepository.findById(request.params.id);

        if (!transform) {
            reply.status(404).send({ error: "Transform not found", statusCode: 404 });
            return;
        }

        reply.send(transform);
    }

    async update(
        request: FastifyRequest<{ Params: TransformIdParams; Body: UpdateTransformBody }>,
        reply: FastifyReply,
    ): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.transformRepository.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Transform not found", statusCode: 404 });
            return;
        }

        const result = await this.deps.transformRepository.update(id, request.body);

        this.deps.logger.info({ id, source: result.source, eventType: result.eventType }, "Transform updated");

        reply.send(result);
    }

    async deactivate(request: FastifyRequest<{ Params: TransformIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.transformRepository.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Transform not found", statusCode: 404 });
            return;
        }

        await this.deps.transformRepository.deactivate(id);

        this.deps.logger.info({ id }, "Transform deactivated");

        reply.status(204).send();
    }

    async destroy(request: FastifyRequest<{ Params: TransformIdParams }>, reply: FastifyReply): Promise<void> {
        const { id } = request.params;
        const existing = await this.deps.transformRepository.findById(id);

        if (!existing) {
            reply.status(404).send({ error: "Transform not found", statusCode: 404 });
            return;
        }

        await this.deps.transformRepository.delete(id);

        this.deps.logger.info(
            { id, source: existing.source, eventType: existing.eventType },
            "Transform permanently deleted",
        );

        reply.status(204).send();
    }

    /**
     * Test a transform against a sample payload without persisting.
     */
    async test(request: FastifyRequest<{ Body: TestTransformBody }>, reply: FastifyReply): Promise<void> {
        const { source, eventType, payload } = request.body;

        const result = await this.deps.applyTransformUseCase.execute(
            {
                id: "test",
                source,
                eventType,
                timestamp: new Date(),
            },
            payload,
        );

        reply.send({
            original: payload,
            transformed: result,
            hasTransform: result !== payload,
        });
    }
}
