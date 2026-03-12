import type {
    IReconciler,
    ReconciliationResult,
} from "../../domain/ingestion/application/interfaces/reconciler.interface.js";
import type { ReconcileSourceUseCase } from "../../domain/ingestion/application/use-cases/reconcile-source.use-case.js";
import type { Logger } from "../config/logger.js";

export interface ReconciliationJobDeps {
    reconcileSourceUseCase: ReconcileSourceUseCase;
    reconcilers: IReconciler[];
    logger: Logger;
    /** How far back to look, in milliseconds. Default: 30 minutes. */
    windowMs?: number;
}

/**
 * Periodic job that runs reconciliation for all registered source reconcilers.
 * Compares events from external APIs with what Topaz has stored
 * and injects any missing events into the pipeline.
 */
export class ReconciliationJob {
    private readonly windowMs: number;

    constructor(private readonly deps: ReconciliationJobDeps) {
        this.windowMs = deps.windowMs ?? 30 * 60 * 1000; // 30 minutes
    }

    async execute(): Promise<ReconciliationResult[]> {
        const results: ReconciliationResult[] = [];
        const to = new Date();
        const from = new Date(to.getTime() - this.windowMs);

        for (const reconciler of this.deps.reconcilers) {
            try {
                const result = await this.deps.reconcileSourceUseCase.execute(reconciler, from, to);
                results.push(result);

                if (result.missingCount > 0) {
                    this.deps.logger.warn(
                        {
                            source: reconciler.source,
                            missing: result.missingCount,
                            injected: result.injectedCount,
                        },
                        "Reconciliation found discrepancies",
                    );
                }
            } catch (error) {
                this.deps.logger.error(
                    { source: reconciler.source, error: (error as Error).message },
                    "Reconciliation failed for source",
                );
            }
        }

        return results;
    }
}
