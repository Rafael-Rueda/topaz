import { z } from "zod";

export const WebhookPayloadSchema = z.object({
    id: z.string(),
    source: z.string(),
    timestamp: z.date(),
    headers: z.record(z.string()),
    body: z.unknown(),
    signature: z.string().optional(),
});

export type WebhookPayloadProps = z.infer<typeof WebhookPayloadSchema>;

export class WebhookPayload {
    private constructor(private readonly props: WebhookPayloadProps) {}

    static create(props: WebhookPayloadProps): WebhookPayload {
        return new WebhookPayload(props);
    }

    get id(): string {
        return this.props.id;
    }

    get source(): string {
        return this.props.source;
    }

    get timestamp(): Date {
        return this.props.timestamp;
    }

    get headers(): Record<string, string> {
        return this.props.headers;
    }

    get body(): unknown {
        return this.props.body;
    }

    get signature(): string | undefined {
        return this.props.signature;
    }

    toJSON(): WebhookPayloadProps {
        return { ...this.props };
    }
}
