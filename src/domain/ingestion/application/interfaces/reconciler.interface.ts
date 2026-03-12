/**
 * Represents an external event fetched from a source's API during reconciliation.
 */
export interface ExternalEvent {
    externalId: string;
    eventType: string;
    payload: unknown;
    occurredAt: Date;
}

/**
 * Represents a discrepancy found during reconciliation:
 * an event that exists in the source but not in Topaz.
 */
export interface ReconciliationDiscrepancy {
    source: string;
    externalId: string;
    eventType: string;
    payload: unknown;
    occurredAt: Date;
}

/**
 * Result of a reconciliation run.
 */
export interface ReconciliationResult {
    source: string;
    periodStart: Date;
    periodEnd: Date;
    externalCount: number;
    matchedCount: number;
    missingCount: number;
    injectedCount: number;
    discrepancies: ReconciliationDiscrepancy[];
}

/**
 * Each source adapter implements this interface to fetch events from the external API.
 * The reconciliation job uses it to compare with Topaz's stored events.
 */
export interface IReconciler {
    readonly source: string;

    /**
     * Fetches events from the external source's API for a given time window.
     */
    fetchEvents(from: Date, to: Date): Promise<ExternalEvent[]>;
}
