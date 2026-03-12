import type { EventStatus, ValidationStatus } from "../../../../generated/prisma/client.js";

export interface EventProps {
    id: string;
    externalId: string | null;
    source: string;
    eventType: string | null;
    status: EventStatus;
    payload: unknown;
    headers: unknown;
    signature: string | null;
    validationStatus: ValidationStatus;
    validationErrors: unknown | null;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
    queuedAt: Date | null;
    processedAt: Date | null;
    failedAt: Date | null;
}

export class Event {
    private constructor(private props: EventProps) {}

    static create(
        input: Pick<EventProps, "id" | "source" | "payload" | "headers"> &
            Partial<Pick<EventProps, "externalId" | "eventType" | "signature">>,
    ): Event {
        return new Event({
            ...input,
            externalId: input.externalId ?? null,
            eventType: input.eventType ?? null,
            signature: input.signature ?? null,
            status: "RECEIVED",
            validationStatus: "SKIPPED",
            validationErrors: null,
            attempts: 0,
            lastError: null,
            createdAt: new Date(),
            queuedAt: null,
            processedAt: null,
            failedAt: null,
        });
    }

    static fromPersistence(props: EventProps): Event {
        return new Event(props);
    }

    get id(): string {
        return this.props.id;
    }
    get externalId(): string | null {
        return this.props.externalId;
    }
    get source(): string {
        return this.props.source;
    }
    get eventType(): string | null {
        return this.props.eventType;
    }
    get status(): EventStatus {
        return this.props.status;
    }
    get payload(): unknown {
        return this.props.payload;
    }
    get headers(): unknown {
        return this.props.headers;
    }
    get signature(): string | null {
        return this.props.signature;
    }
    get validationStatus(): ValidationStatus {
        return this.props.validationStatus;
    }
    get attempts(): number {
        return this.props.attempts;
    }
    get lastError(): string | null {
        return this.props.lastError;
    }
    get createdAt(): Date {
        return this.props.createdAt;
    }

    markQueued(): void {
        this.props.status = "QUEUED";
        this.props.queuedAt = new Date();
    }

    markProcessing(): void {
        this.props.status = "PROCESSING";
        this.props.attempts += 1;
    }

    markDelivered(): void {
        this.props.status = "DELIVERED";
        this.props.processedAt = new Date();
    }

    markFailed(error: string): void {
        this.props.status = "FAILED";
        this.props.lastError = error;
        this.props.failedAt = new Date();
    }

    markDead(): void {
        this.props.status = "DEAD";
    }

    setValidation(status: ValidationStatus, errors?: unknown): void {
        this.props.validationStatus = status;
        this.props.validationErrors = errors ?? null;
    }

    toJSON(): EventProps {
        return { ...this.props };
    }
}
