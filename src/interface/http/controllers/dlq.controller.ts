import type { FastifyReply, FastifyRequest } from "fastify";

import type { IEventRepository } from "../../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Logger } from "../../../infra/config/logger.js";

interface DlqQuery {
    source?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
}

export interface DlqControllerDeps {
    prisma: PrismaClient;
    eventRepository: IEventRepository;
    logger: Logger;
}

export class DlqController {
    constructor(private readonly deps: DlqControllerDeps) {}

    async list(request: FastifyRequest<{ Querystring: DlqQuery }>, reply: FastifyReply): Promise<void> {
        const { source, eventType, limit = 50, offset = 0 } = request.query;

        const where = {
            status: "DEAD" as const,
            ...(source && { source }),
            ...(eventType && { eventType }),
        };

        const [events, total] = await Promise.all([
            this.deps.prisma.event.findMany({
                where,
                take: limit,
                skip: offset,
                orderBy: { failedAt: "desc" },
            }),
            this.deps.prisma.event.count({ where }),
        ]);

        reply.send({ data: events, total, limit, offset });
    }

    async getEvent(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
        const event = await this.deps.prisma.event.findFirst({
            where: { id: request.params.id, status: "DEAD" },
        });

        if (!event) {
            reply.status(404).send({ error: "DLQ event not found", statusCode: 404 });
            return;
        }

        reply.send(event);
    }

    async discard(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
        const event = await this.deps.prisma.event.findFirst({
            where: { id: request.params.id, status: "DEAD" },
        });

        if (!event) {
            reply.status(404).send({ error: "DLQ event not found", statusCode: 404 });
            return;
        }

        await this.deps.eventRepository.updateStatus(request.params.id, "DISCARDED");

        this.deps.logger.info({ eventId: request.params.id }, "DLQ event discarded");

        reply.send({ status: "discarded", eventId: request.params.id });
    }

    async discardBatch(request: FastifyRequest<{ Body: { ids: string[] } }>, reply: FastifyReply): Promise<void> {
        const { ids } = request.body;

        await this.deps.eventRepository.updateStatusBatch(ids, "DISCARDED");

        this.deps.logger.info({ count: ids.length }, "DLQ events discarded in batch");

        reply.send({ status: "discarded", count: ids.length });
    }
}
