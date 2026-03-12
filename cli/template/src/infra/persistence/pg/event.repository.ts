import type {
    IEventRepository,
    ReplayFilters,
    SaveEventInput,
} from "../../../domain/ingestion/application/interfaces/event-repository.interface.js";
import type { EventProps } from "../../../domain/ingestion/enterprise/entities/event.js";
import type { EventStatus, PrismaClient } from "../../../generated/prisma/client.js";

export class PrismaEventRepository implements IEventRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async saveBatch(events: SaveEventInput[]): Promise<void> {
        await this.prisma.event.createMany({
            data: events.map((e) => ({
                id: e.id,
                externalId: e.externalId ?? null,
                source: e.source,
                eventType: e.eventType ?? null,
                payload: e.payload as object,
                headers: e.headers as object,
                signature: e.signature ?? null,
                status: "RECEIVED",
                validationStatus: e.validationStatus ?? "SKIPPED",
                validationErrors: e.validationErrors ? (e.validationErrors as object) : undefined,
            })),
            skipDuplicates: true,
        });
    }

    async updateStatus(id: string, status: EventStatus, extra?: Partial<EventProps>): Promise<void> {
        await this.prisma.event.update({
            where: { id },
            data: {
                status,
                ...(extra?.lastError !== undefined && { lastError: extra.lastError }),
                ...(extra?.attempts !== undefined && { attempts: extra.attempts }),
                ...(extra?.processedAt !== undefined && { processedAt: extra.processedAt }),
                ...(extra?.failedAt !== undefined && { failedAt: extra.failedAt }),
                ...(extra?.queuedAt !== undefined && { queuedAt: extra.queuedAt }),
            },
        });
    }

    async updateStatusBatch(ids: string[], status: EventStatus, extra?: Partial<EventProps>): Promise<void> {
        await this.prisma.event.updateMany({
            where: { id: { in: ids } },
            data: {
                status,
                ...(extra?.lastError !== undefined && { lastError: extra.lastError }),
                ...(extra?.queuedAt !== undefined && { queuedAt: extra.queuedAt }),
            },
        });
    }

    async findByStatus(status: EventStatus, limit = 100): Promise<EventProps[]> {
        const events = await this.prisma.event.findMany({
            where: { status },
            take: limit,
            orderBy: { createdAt: "asc" },
        });

        return events.map((e) => ({
            ...e,
            payload: e.payload as unknown,
            headers: e.headers as unknown,
            validationErrors: e.validationErrors as unknown,
        }));
    }

    async findStuckReceived(olderThanMs: number, limit = 100): Promise<EventProps[]> {
        const threshold = new Date(Date.now() - olderThanMs);

        const events = await this.prisma.event.findMany({
            where: {
                status: "RECEIVED",
                createdAt: { lt: threshold },
            },
            take: limit,
            orderBy: { createdAt: "asc" },
        });

        return events.map((e) => ({
            ...e,
            payload: e.payload as unknown,
            headers: e.headers as unknown,
            validationErrors: e.validationErrors as unknown,
        }));
    }

    async findForReplay(filters: ReplayFilters): Promise<EventProps[]> {
        const events = await this.prisma.event.findMany({
            where: this.buildReplayWhere(filters),
            take: filters.limit ?? 100,
            skip: filters.offset ?? 0,
            orderBy: { createdAt: "asc" },
        });

        return events.map((e) => ({
            ...e,
            payload: e.payload as unknown,
            headers: e.headers as unknown,
            validationErrors: e.validationErrors as unknown,
        }));
    }

    async findByExternalId(source: string, externalId: string): Promise<EventProps | null> {
        const event = await this.prisma.event.findUnique({
            where: { source_externalId: { source, externalId } },
        });

        if (!event) return null;

        return {
            ...event,
            payload: event.payload as unknown,
            headers: event.headers as unknown,
            validationErrors: event.validationErrors as unknown,
        };
    }

    async countForReplay(filters: ReplayFilters): Promise<number> {
        return this.prisma.event.count({
            where: this.buildReplayWhere(filters),
        });
    }

    private buildReplayWhere(filters: ReplayFilters) {
        return {
            ...(filters.source && { source: filters.source }),
            ...(filters.eventType && { eventType: filters.eventType }),
            ...(filters.status && { status: filters.status }),
            ...((filters.from || filters.to) && {
                createdAt: {
                    ...(filters.from && { gte: filters.from }),
                    ...(filters.to && { lte: filters.to }),
                },
            }),
        };
    }
}
