import type { IEventRepository, ReplayFilters } from "../interfaces/event-repository.interface.js";
import type { IReplayRepository, ReplayRequestProps } from "../interfaces/replay-repository.interface.js";

export interface RequestReplayInput {
    filterSource?: string;
    filterEventType?: string;
    filterStatus?: "FAILED" | "DEAD" | "DELIVERED";
    filterFrom?: Date;
    filterTo?: Date;
    requestedBy?: string;
}

export interface PreviewReplayOutput {
    totalEvents: number;
    filters: ReplayFilters;
}

export interface RequestReplayDeps {
    eventRepository: IEventRepository;
    replayRepository: IReplayRepository;
}

export class RequestReplayUseCase {
    constructor(private readonly deps: RequestReplayDeps) {}

    /**
     * Preview how many events would be replayed (dry-run).
     */
    async preview(input: RequestReplayInput): Promise<PreviewReplayOutput> {
        const filters = this.buildFilters(input);
        const totalEvents = await this.deps.eventRepository.countForReplay(filters);

        return { totalEvents, filters };
    }

    /**
     * Create a replay request and return it with status PENDING.
     * The actual replay execution is handled by ExecuteReplayUseCase.
     */
    async execute(input: RequestReplayInput): Promise<ReplayRequestProps> {
        const filters = this.buildFilters(input);
        const totalEvents = await this.deps.eventRepository.countForReplay(filters);

        if (totalEvents === 0) {
            throw new NoEventsToReplayError("No events match the given filters");
        }

        const replay = await this.deps.replayRepository.create(
            {
                filterSource: input.filterSource,
                filterEventType: input.filterEventType,
                filterStatus: input.filterStatus,
                filterFrom: input.filterFrom,
                filterTo: input.filterTo,
                requestedBy: input.requestedBy,
            },
            totalEvents,
        );

        return replay;
    }

    private buildFilters(input: RequestReplayInput): ReplayFilters {
        return {
            source: input.filterSource,
            eventType: input.filterEventType,
            status: input.filterStatus,
            from: input.filterFrom,
            to: input.filterTo,
        };
    }
}

export class NoEventsToReplayError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NoEventsToReplayError";
    }
}
