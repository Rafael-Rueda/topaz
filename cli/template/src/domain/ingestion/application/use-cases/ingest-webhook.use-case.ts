import { nanoid } from "nanoid";

import type { DeduplicateEventUseCase } from "./deduplicate-event.use-case.js";
import type { ValidatePayloadUseCase } from "./validate-payload.use-case.js";
import type { ValidationStatus } from "../../../../generated/prisma/client.js";
import type { WebhookBuffer } from "../../../../infra/persistence/webhook-buffer.js";
import { WebhookPayload } from "../../enterprise/entities/webhook-payload.js";

export interface IngestWebhookInput {
    source: string;
    headers: Record<string, string>;
    body: unknown;
    signature?: string;
    eventType?: string;
}

export interface IngestWebhookOutput {
    id: string;
    persisted: boolean;
    duplicate: boolean;
    validation: {
        status: string;
        errors: object[] | null;
    };
}

export interface IngestWebhookDeps {
    webhookBuffer: WebhookBuffer;
    validatePayloadUseCase: ValidatePayloadUseCase;
    deduplicateEventUseCase: DeduplicateEventUseCase;
}

export class IngestWebhookUseCase {
    constructor(private readonly deps: IngestWebhookDeps) {}

    async execute(input: IngestWebhookInput): Promise<IngestWebhookOutput> {
        const id = nanoid();

        // Detect eventType from payload (e.g.: Stripe sends it in event.type)
        const eventType = input.eventType ?? this.detectEventType(input.source, input.body);

        // Deduplication check (Redis hot path)
        const dedup = await this.deps.deduplicateEventUseCase.execute(input.source, input.body);

        if (dedup.isDuplicate) {
            return {
                id,
                persisted: false,
                duplicate: true,
                validation: { status: "SKIPPED", errors: null },
            };
        }

        // Validate payload against registered schema
        const validation = await this.deps.validatePayloadUseCase.execute({
            source: input.source,
            eventType,
            payload: input.body,
        });

        // If rejectOnFail is set and payload is invalid, reject immediately (400)
        if (validation.status === "INVALID" && validation.rejectOnFail) {
            throw new SchemaValidationError(
                `Payload validation failed for ${input.source}:${eventType}`,
                validation.errors,
            );
        }

        const payload = WebhookPayload.create({
            id,
            source: input.source,
            timestamp: new Date(),
            headers: input.headers,
            body: input.body,
            signature: input.signature,
            eventType,
        });

        const result = await this.deps.webhookBuffer.add(
            {
                id,
                externalId: dedup.externalId,
                source: input.source,
                eventType,
                payload: input.body,
                headers: input.headers,
                signature: input.signature,
                validationStatus: validation.status as ValidationStatus,
                validationErrors: validation.errors,
            },
            payload.toJSON(),
        );

        return {
            id: result.id,
            persisted: true,
            duplicate: false,
            validation: {
                status: validation.status,
                errors: validation.errors,
            },
        };
    }

    /**
     * Tries to extract the event type from the payload based on source.
     * Each provider has its own convention:
     * - Stripe: body.type ("checkout.session.completed")
     * - GitHub: header x-github-event
     */
    private detectEventType(_source: string, body: unknown): string | null {
        if (!body || typeof body !== "object") return null;

        const payload = body as Record<string, unknown>;

        // Generic convention: "type" or "event" field in body
        if (typeof payload.type === "string") return payload.type;
        if (typeof payload.event === "string") return payload.event;
        if (typeof payload.event_type === "string") return payload.event_type;

        return null;
    }
}

export class SchemaValidationError extends Error {
    constructor(
        message: string,
        public readonly errors: object[] | null,
    ) {
        super(message);
        this.name = "SchemaValidationError";
    }
}
