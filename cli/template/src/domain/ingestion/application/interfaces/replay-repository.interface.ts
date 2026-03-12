import type { EventStatus, ReplayStatus } from "../../../../generated/prisma/client.js";

export interface ReplayRequestProps {
    id: string;
    filterSource: string | null;
    filterEventType: string | null;
    filterStatus: EventStatus | null;
    filterFrom: Date | null;
    filterTo: Date | null;
    totalEvents: number;
    replayedEvents: number;
    status: ReplayStatus;
    requestedBy: string | null;
    createdAt: Date;
    completedAt: Date | null;
}

export interface CreateReplayInput {
    filterSource?: string;
    filterEventType?: string;
    filterStatus?: EventStatus;
    filterFrom?: Date;
    filterTo?: Date;
    requestedBy?: string;
}

export interface IReplayRepository {
    create(input: CreateReplayInput, totalEvents: number): Promise<ReplayRequestProps>;
    findById(id: string): Promise<ReplayRequestProps | null>;
    findAll(limit?: number, offset?: number): Promise<ReplayRequestProps[]>;
    updateProgress(id: string, replayedEvents: number): Promise<void>;
    updateStatus(id: string, status: ReplayStatus): Promise<void>;
    complete(id: string, replayedEvents: number): Promise<void>;
}
