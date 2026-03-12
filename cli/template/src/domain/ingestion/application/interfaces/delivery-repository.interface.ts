export interface DeliveryProps {
    id: string;
    eventId: string;
    routeId: string;
    status: "PENDING" | "DELIVERED" | "FAILED";
    responseCode: number | null;
    responseBody: string | null;
    durationMs: number | null;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
    completedAt: Date | null;
}

export interface CreateDeliveryInput {
    eventId: string;
    routeId: string;
}

export interface UpdateDeliveryInput {
    status?: "PENDING" | "DELIVERED" | "FAILED";
    responseCode?: number;
    responseBody?: string;
    durationMs?: number;
    attempts?: number;
    lastError?: string;
    completedAt?: Date;
}

export interface IDeliveryRepository {
    create(input: CreateDeliveryInput): Promise<DeliveryProps>;
    findById(id: string): Promise<DeliveryProps | null>;
    findByEventId(eventId: string): Promise<DeliveryProps[]>;
    findByRouteId(routeId: string): Promise<DeliveryProps[]>;
    findPendingDeliveries(limit?: number): Promise<DeliveryProps[]>;
    update(id: string, input: UpdateDeliveryInput): Promise<DeliveryProps>;
    updateStatus(
        id: string,
        status: "PENDING" | "DELIVERED" | "FAILED",
        data?: Partial<UpdateDeliveryInput>,
    ): Promise<void>;
}
