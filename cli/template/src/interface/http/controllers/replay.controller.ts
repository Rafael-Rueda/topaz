import type { FastifyReply, FastifyRequest } from "fastify";

import type { IReplayRepository } from "../../../domain/ingestion/application/interfaces/replay-repository.interface.js";
import type { ExecuteReplayUseCase } from "../../../domain/ingestion/application/use-cases/execute-replay.use-case.js";
import {
    NoEventsToReplayError,
    type RequestReplayUseCase,
} from "../../../domain/ingestion/application/use-cases/request-replay.use-case.js";
import type { Logger } from "../../../infra/config/logger.js";

interface PreviewBody {
    filterSource?: string;
    filterEventType?: string;
    filterStatus?: "FAILED" | "DEAD" | "DELIVERED";
    filterFrom?: string;
    filterTo?: string;
}

interface ExecuteBody extends PreviewBody {
    requestedBy?: string;
}

interface ReplayIdParams {
    id: string;
}

interface HistoryQuery {
    limit?: number;
    offset?: number;
}

export interface ReplayControllerDeps {
    requestReplayUseCase: RequestReplayUseCase;
    executeReplayUseCase: ExecuteReplayUseCase;
    replayRepository: IReplayRepository;
    logger: Logger;
}

export class ReplayController {
    constructor(private readonly deps: ReplayControllerDeps) {}

    async preview(request: FastifyRequest<{ Body: PreviewBody }>, reply: FastifyReply): Promise<void> {
        const filters = this.parseFilters(request.body);
        const result = await this.deps.requestReplayUseCase.preview(filters);

        reply.send({
            totalEvents: result.totalEvents,
            filters: result.filters,
            message: `${result.totalEvents} events would be replayed`,
        });
    }

    async execute(request: FastifyRequest<{ Body: ExecuteBody }>, reply: FastifyReply): Promise<void> {
        const filters = this.parseFilters(request.body);

        try {
            // Create the replay request
            const replay = await this.deps.requestReplayUseCase.execute({
                ...filters,
                requestedBy: request.body.requestedBy,
            });

            this.deps.logger.info({ replayId: replay.id, total: replay.totalEvents }, "Replay request created");

            // Execute asynchronously (non-blocking)
            this.deps.executeReplayUseCase.execute(replay.id).catch((err) => {
                this.deps.logger.error(
                    { error: (err as Error).message, replayId: replay.id },
                    "Replay execution error",
                );
            });

            reply.status(202).send({
                status: "accepted",
                replayId: replay.id,
                totalEvents: replay.totalEvents,
                message: "Replay started",
            });
        } catch (error) {
            if (error instanceof NoEventsToReplayError) {
                reply.status(404).send({
                    error: "No events match the given filters",
                    statusCode: 404,
                });
                return;
            }
            throw error;
        }
    }

    async getStatus(request: FastifyRequest<{ Params: ReplayIdParams }>, reply: FastifyReply): Promise<void> {
        const replay = await this.deps.replayRepository.findById(request.params.id);

        if (!replay) {
            reply.status(404).send({ error: "Replay not found", statusCode: 404 });
            return;
        }

        const progress = replay.totalEvents > 0 ? Math.round((replay.replayedEvents / replay.totalEvents) * 100) : 0;

        reply.send({
            ...replay,
            progress: `${progress}%`,
        });
    }

    async cancel(request: FastifyRequest<{ Params: ReplayIdParams }>, reply: FastifyReply): Promise<void> {
        const replay = await this.deps.replayRepository.findById(request.params.id);

        if (!replay) {
            reply.status(404).send({ error: "Replay not found", statusCode: 404 });
            return;
        }

        if (replay.status !== "PENDING" && replay.status !== "IN_PROGRESS") {
            reply.status(400).send({
                error: `Cannot cancel replay with status ${replay.status}`,
                statusCode: 400,
            });
            return;
        }

        await this.deps.replayRepository.updateStatus(replay.id, "CANCELLED");

        this.deps.logger.info({ replayId: replay.id }, "Replay cancelled");

        reply.send({ status: "cancelled", replayId: replay.id });
    }

    async history(request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply): Promise<void> {
        const limit = request.query.limit ?? 50;
        const offset = request.query.offset ?? 0;

        const replays = await this.deps.replayRepository.findAll(limit, offset);

        reply.send({ data: replays, total: replays.length, limit, offset });
    }

    private parseFilters(body: PreviewBody) {
        return {
            filterSource: body.filterSource,
            filterEventType: body.filterEventType,
            filterStatus: body.filterStatus,
            filterFrom: body.filterFrom ? new Date(body.filterFrom) : undefined,
            filterTo: body.filterTo ? new Date(body.filterTo) : undefined,
        };
    }
}
