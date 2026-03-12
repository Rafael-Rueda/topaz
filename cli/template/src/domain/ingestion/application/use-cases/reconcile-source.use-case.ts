import { nanoid } from "nanoid";

import type { Logger } from "../../../../infra/config/logger.js";
import type { IEventRepository } from "../interfaces/event-repository.interface.js";
import type { IWebhookQueueProducer } from "../interfaces/queue-producer.interface.js";
import type {
    IReconciler,
    ReconciliationDiscrepancy,
    ReconciliationResult,
} from "../interfaces/reconciler.interface.js";

export interface ReconcileSourceDeps {
    eventRepository: IEventRepository;
    webhookQueueProducer: IWebhookQueueProducer;
    logger: Logger;
}

/**
 * Compares events from an external source's API with what Topaz has stored.
 * Any missing events are injected as synthetic events into the pipeline.
 */
export class ReconcileSourceUseCase {
    constructor(private readonly deps: ReconcileSourceDeps) {}

    async execute(reconciler: IReconciler, from: Date, to: Date): Promise<ReconciliationResult> {
        const source = reconciler.source;

        this.deps.logger.info({ source, from, to }, "Starting reconciliation");

        // 1. Fetch events from external API
        const externalEvents = await reconciler.fetchEvents(from, to);

        this.deps.logger.info(
            { source, externalCount: externalEvents.length },
            "Fetched external events for reconciliation",
        );

        // 2. Check which ones exist in Topaz by externalId
        const discrepancies: ReconciliationDiscrepancy[] = [];
        let matchedCount = 0;

        for (const ext of externalEvents) {
            const existing = await this.deps.eventRepository.findByExternalId(source, ext.externalId);

            if (existing) {
                matchedCount++;
            } else {
                discrepancies.push({
                    source,
                    externalId: ext.externalId,
                    eventType: ext.eventType,
                    payload: ext.payload,
                    occurredAt: ext.occurredAt,
                });
            }
        }

        // 3. Inject missing events into the pipeline
        let injectedCount = 0;

        if (discrepancies.length > 0) {
            this.deps.logger.warn(
                { source, missingCount: discrepancies.length },
                "Reconciliation found missing events — injecting synthetic events",
            );

            for (const disc of discrepancies) {
                const id = nanoid();

                await this.deps.eventRepository.saveBatch([
                    {
                        id,
                        externalId: disc.externalId,
                        source: disc.source,
                        eventType: disc.eventType,
                        payload: disc.payload,
                        headers: { "x-topaz-reconciled": "true" },
                    },
                ]);

                await this.deps.webhookQueueProducer.enqueue({
                    id,
                    source: disc.source,
                    timestamp: disc.occurredAt,
                    headers: { "x-topaz-reconciled": "true" },
                    body: disc.payload,
                    eventType: disc.eventType,
                });

                injectedCount++;
            }
        }

        const result: ReconciliationResult = {
            source,
            periodStart: from,
            periodEnd: to,
            externalCount: externalEvents.length,
            matchedCount,
            missingCount: discrepancies.length,
            injectedCount,
            discrepancies,
        };

        this.deps.logger.info(
            {
                source,
                externalCount: result.externalCount,
                matchedCount: result.matchedCount,
                missingCount: result.missingCount,
                injectedCount: result.injectedCount,
            },
            "Reconciliation complete",
        );

        return result;
    }
}
