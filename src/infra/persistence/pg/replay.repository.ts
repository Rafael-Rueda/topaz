import type {
    CreateReplayInput,
    IReplayRepository,
    ReplayRequestProps,
} from "../../../domain/ingestion/application/interfaces/replay-repository.interface.js";
import type { PrismaClient, ReplayRequest, ReplayStatus } from "../../../generated/prisma/client.js";

export class PrismaReplayRepository implements IReplayRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateReplayInput, totalEvents: number): Promise<ReplayRequestProps> {
        const replay = await this.prisma.replayRequest.create({
            data: {
                filterSource: input.filterSource ?? null,
                filterEventType: input.filterEventType ?? null,
                filterStatus: input.filterStatus ?? null,
                filterFrom: input.filterFrom ?? null,
                filterTo: input.filterTo ?? null,
                requestedBy: input.requestedBy ?? null,
                totalEvents,
                status: "PENDING",
            },
        });

        return this.toProps(replay);
    }

    async findById(id: string): Promise<ReplayRequestProps | null> {
        const replay = await this.prisma.replayRequest.findUnique({ where: { id } });
        return replay ? this.toProps(replay) : null;
    }

    async findAll(limit = 50, offset = 0): Promise<ReplayRequestProps[]> {
        const replays = await this.prisma.replayRequest.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" },
        });
        return replays.map((r) => this.toProps(r));
    }

    async updateProgress(id: string, replayedEvents: number): Promise<void> {
        await this.prisma.replayRequest.update({
            where: { id },
            data: { replayedEvents },
        });
    }

    async updateStatus(id: string, status: ReplayStatus): Promise<void> {
        await this.prisma.replayRequest.update({
            where: { id },
            data: { status },
        });
    }

    async complete(id: string, replayedEvents: number): Promise<void> {
        await this.prisma.replayRequest.update({
            where: { id },
            data: {
                status: "COMPLETED",
                replayedEvents,
                completedAt: new Date(),
            },
        });
    }

    private toProps(replay: ReplayRequest): ReplayRequestProps {
        return {
            id: replay.id,
            filterSource: replay.filterSource,
            filterEventType: replay.filterEventType,
            filterStatus: replay.filterStatus,
            filterFrom: replay.filterFrom,
            filterTo: replay.filterTo,
            totalEvents: replay.totalEvents,
            replayedEvents: replay.replayedEvents,
            status: replay.status,
            requestedBy: replay.requestedBy,
            createdAt: replay.createdAt,
            completedAt: replay.completedAt,
        };
    }
}
