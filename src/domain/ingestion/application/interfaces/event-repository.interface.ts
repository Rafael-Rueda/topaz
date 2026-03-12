import type { EventStatus, ValidationStatus } from "../../../../generated/prisma/client.js";
import type { EventProps } from "../../enterprise/entities/event.js";

export interface SaveEventInput {
    id: string;
    externalId?: string | null;
    source: string;
    eventType?: string | null;
    payload: unknown;
    headers: unknown;
    signature?: string | null;
    validationStatus?: ValidationStatus;
    validationErrors?: unknown;
}

export interface IEventRepository {
    saveBatch(events: SaveEventInput[]): Promise<void>;
    updateStatus(id: string, status: EventStatus, extra?: Partial<EventProps>): Promise<void>;
    updateStatusBatch(ids: string[], status: EventStatus, extra?: Partial<EventProps>): Promise<void>;
    findByStatus(status: EventStatus, limit?: number): Promise<EventProps[]>;
    findStuckReceived(olderThanMs: number, limit?: number): Promise<EventProps[]>;
    findForReplay(filters: ReplayFilters): Promise<EventProps[]>;
    countForReplay(filters: ReplayFilters): Promise<number>;
    findByExternalId(source: string, externalId: string): Promise<EventProps | null>;
}

export interface ReplayFilters {
    source?: string;
    eventType?: string;
    status?: EventStatus;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}
