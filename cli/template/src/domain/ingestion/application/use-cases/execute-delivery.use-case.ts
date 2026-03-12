import type { Logger } from "../../../../infra/config/logger.js";
import type { IDeliveryRepository } from "../interfaces/delivery-repository.interface.js";
import type { RouteProps } from "../interfaces/route-repository.interface.js";

export interface ExecuteDeliveryDeps {
    deliveryRepository: IDeliveryRepository;
    logger: Logger;
}

export interface DeliveryResult {
    success: boolean;
    responseCode?: number;
    responseBody?: string;
    durationMs: number;
    error?: string;
}

export class ExecuteDeliveryUseCase {
    constructor(private readonly deps: ExecuteDeliveryDeps) {}

    /**
     * Execute delivery of a webhook payload to a target route.
     * Creates a delivery record and attempts to POST to the target URL.
     */
    async execute(eventId: string, route: RouteProps, payload: unknown): Promise<DeliveryResult> {
        const startTime = Date.now();

        // Create delivery record
        const delivery = await this.deps.deliveryRepository.create({
            eventId,
            routeId: route.id,
        });

        this.deps.logger.debug({ deliveryId: delivery.id, eventId, target: route.targetUrl }, "Starting delivery");

        try {
            // Prepare headers
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                ...route.headers,
            };

            // Execute HTTP request
            const response = await fetch(route.targetUrl, {
                method: route.method,
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(route.timeout),
            });

            const durationMs = Date.now() - startTime;
            const responseBody = await this.readResponseBody(response);

            // Truncate response body if too long
            const truncatedBody = responseBody.length > 1000 ? `${responseBody.substring(0, 1000)}...` : responseBody;

            if (response.ok) {
                // Success
                await this.deps.deliveryRepository.updateStatus(delivery.id, "DELIVERED", {
                    responseCode: response.status,
                    responseBody: truncatedBody,
                    durationMs,
                    attempts: 1,
                });

                this.deps.logger.info(
                    { deliveryId: delivery.id, eventId, status: response.status, durationMs },
                    "Delivery successful",
                );

                return {
                    success: true,
                    responseCode: response.status,
                    responseBody: truncatedBody,
                    durationMs,
                };
            } else {
                // HTTP error
                await this.deps.deliveryRepository.updateStatus(delivery.id, "FAILED", {
                    responseCode: response.status,
                    responseBody: truncatedBody,
                    durationMs,
                    attempts: 1,
                    lastError: `HTTP ${response.status}: ${response.statusText}`,
                });

                this.deps.logger.warn(
                    { deliveryId: delivery.id, eventId, status: response.status, durationMs },
                    "Delivery failed with HTTP error",
                );

                return {
                    success: false,
                    responseCode: response.status,
                    responseBody: truncatedBody,
                    durationMs,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                };
            }
        } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            await this.deps.deliveryRepository.updateStatus(delivery.id, "FAILED", {
                durationMs,
                attempts: 1,
                lastError: errorMessage,
            });

            this.deps.logger.error(
                { deliveryId: delivery.id, eventId, error: errorMessage, durationMs },
                "Delivery failed with exception",
            );

            return {
                success: false,
                durationMs,
                error: errorMessage,
            };
        }
    }

    private async readResponseBody(response: Response): Promise<string> {
        try {
            return await response.text();
        } catch {
            return "";
        }
    }
}
