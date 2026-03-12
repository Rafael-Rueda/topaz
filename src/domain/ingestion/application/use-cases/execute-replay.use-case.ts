import type { Logger } from "../../../../infra/config/logger.js";
import type { IEventRepository } from "../interfaces/event-repository.interface.js";
import type { IWebhookQueueProducer } from "../interfaces/queue-producer.interface.js";
import type { IReplayRepository, ReplayRequestProps } from "../interfaces/replay-repository.interface.js";

export interface ExecuteReplayDeps {
    eventRepository: IEventRepository;
    replayRepository: IReplayRepository;
    webhookQueueProducer: IWebhookQueueProducer;
    logger: Logger;
}

export class ExecuteReplayUseCase {
    private readonly BATCH_SIZE = 100;
    private readonly BATCH_DELAY_MS = 100; // Delay between batches to avoid overloading targets

    constructor(private readonly deps: ExecuteReplayDeps) {}

    /**
     * Execute a pending replay request: fetch matching events from Postgres,
     * re-enqueue them to Redis, and update progress along the way.
     */
    async execute(replayId: string): Promise<ReplayRequestProps> {
        const replay = await this.deps.replayRepository.findById(replayId);

        if (!replay) {
            throw new Error(`Replay request ${replayId} not found`);
        }

        if (replay.status !== "PENDING") {
            throw new Error(`Replay request ${replayId} is not in PENDING status (current: ${replay.status})`);
        }

        await this.deps.replayRepository.updateStatus(replayId, "IN_PROGRESS");

        this.deps.logger.info({ replayId, totalEvents: replay.totalEvents }, "Starting replay execution");

        let totalReplayed = 0;
        let offset = 0;

        try {
            while (true) {
                const events = await this.deps.eventRepository.findForReplay({
                    source: replay.filterSource ?? undefined,
                    eventType: replay.filterEventType ?? undefined,
                    status: replay.filterStatus ?? undefined,
                    from: replay.filterFrom ?? undefined,
                    to: replay.filterTo ?? undefined,
                    limit: this.BATCH_SIZE,
                    offset,
                });

                if (events.length === 0) break;

                // Check if replay was cancelled mid-execution
                const currentReplay = await this.deps.replayRepository.findById(replayId);
                if (currentReplay?.status === "CANCELLED") {
                    this.deps.logger.info({ replayId, replayed: totalReplayed }, "Replay cancelled mid-execution");
                    return currentReplay;
                }

                const replayedIds: string[] = [];

                for (const event of events) {
                    // Skip events already queued or processing (prevent duplicates)
                    if (event.status === "QUEUED" || event.status === "PROCESSING") {
                        continue;
                    }

                    try {
                        await this.deps.webhookQueueProducer.enqueue(
                            {
                                id: event.id,
                                source: event.source,
                                timestamp: event.createdAt,
                                headers: event.headers as Record<string, string>,
                                body: event.payload,
                                signature: event.signature ?? undefined,
                            },
                            true,
                        ); // isReplay = true
                        replayedIds.push(event.id);
                    } catch (err) {
                        this.deps.logger.error(
                            { error: (err as Error).message, eventId: event.id },
                            "Replay: failed to re-enqueue event",
                        );
                    }
                }

                // Update event statuses to QUEUED
                if (replayedIds.length > 0) {
                    await this.deps.eventRepository.updateStatusBatch(replayedIds, "QUEUED", {
                        queuedAt: new Date(),
                    });
                }

                totalReplayed += replayedIds.length;
                offset += events.length;

                // Update progress
                await this.deps.replayRepository.updateProgress(replayId, totalReplayed);

                this.deps.logger.debug(
                    { replayId, replayed: totalReplayed, total: replay.totalEvents },
                    "Replay progress",
                );

                // Delay between batches to avoid overloading
                if (events.length === this.BATCH_SIZE) {
                    await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY_MS));
                }
            }

            await this.deps.replayRepository.complete(replayId, totalReplayed);

            this.deps.logger.info({ replayId, replayed: totalReplayed, total: replay.totalEvents }, "Replay completed");
        } catch (error) {
            this.deps.logger.error(
                { error: (error as Error).message, replayId, replayed: totalReplayed },
                "Replay execution failed",
            );

            await this.deps.replayRepository.updateProgress(replayId, totalReplayed);
            await this.deps.replayRepository.updateStatus(replayId, "PENDING");
            throw error;
        }

        return (await this.deps.replayRepository.findById(replayId))!;
    }
}
