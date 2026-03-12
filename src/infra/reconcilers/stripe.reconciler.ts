import type { ExternalEvent, IReconciler } from "../../domain/ingestion/application/interfaces/reconciler.interface.js";
import type { Logger } from "../config/logger.js";

export interface StripeReconcilerConfig {
    apiKey: string;
    apiBaseUrl?: string;
}

/**
 * Reconciler for Stripe that fetches events from the Stripe API
 * and compares them with events stored in Topaz.
 *
 * Uses the Stripe List Events API:
 * GET https://api.stripe.com/v1/events?created[gte]=...&created[lte]=...
 */
export class StripeReconciler implements IReconciler {
    readonly source = "stripe";

    constructor(
        private readonly config: StripeReconcilerConfig,
        private readonly logger: Logger,
    ) {}

    async fetchEvents(from: Date, to: Date): Promise<ExternalEvent[]> {
        const baseUrl = this.config.apiBaseUrl ?? "https://api.stripe.com";
        const events: ExternalEvent[] = [];
        let hasMore = true;
        let startingAfter: string | undefined;

        while (hasMore) {
            const params = new URLSearchParams({
                "created[gte]": Math.floor(from.getTime() / 1000).toString(),
                "created[lte]": Math.floor(to.getTime() / 1000).toString(),
                limit: "100",
            });

            if (startingAfter) {
                params.set("starting_after", startingAfter);
            }

            const url = `${baseUrl}/v1/events?${params.toString()}`;

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            if (!response.ok) {
                this.logger.error(
                    { status: response.status, source: this.source },
                    "Failed to fetch events from Stripe API",
                );
                throw new Error(`Stripe API returned ${response.status}`);
            }

            const data = (await response.json()) as StripeListResponse;

            for (const event of data.data) {
                events.push({
                    externalId: event.id,
                    eventType: event.type,
                    payload: event,
                    occurredAt: new Date(event.created * 1000),
                });
            }

            hasMore = data.has_more;
            if (data.data.length > 0) {
                startingAfter = data.data[data.data.length - 1].id;
            }
        }

        this.logger.info({ source: this.source, count: events.length, from, to }, "Fetched events from Stripe API");

        return events;
    }
}

interface StripeEvent {
    id: string;
    type: string;
    created: number;
    [key: string]: unknown;
}

interface StripeListResponse {
    data: StripeEvent[];
    has_more: boolean;
}
