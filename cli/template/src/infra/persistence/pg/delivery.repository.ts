import type {
    CreateDeliveryInput,
    DeliveryProps,
    IDeliveryRepository,
    UpdateDeliveryInput,
} from "../../../domain/ingestion/application/interfaces/delivery-repository.interface.js";
import type { Delivery, PrismaClient } from "../../../generated/prisma/client.js";

export class PrismaDeliveryRepository implements IDeliveryRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateDeliveryInput): Promise<DeliveryProps> {
        const delivery = await this.prisma.delivery.create({
            data: {
                eventId: input.eventId,
                routeId: input.routeId,
                status: "PENDING",
            },
        });
        return this.toProps(delivery);
    }

    async findById(id: string): Promise<DeliveryProps | null> {
        const delivery = await this.prisma.delivery.findUnique({ where: { id } });
        return delivery ? this.toProps(delivery) : null;
    }

    async findByEventId(eventId: string): Promise<DeliveryProps[]> {
        const deliveries = await this.prisma.delivery.findMany({
            where: { eventId },
            orderBy: { createdAt: "desc" },
        });
        return deliveries.map((d) => this.toProps(d));
    }

    async findByRouteId(routeId: string): Promise<DeliveryProps[]> {
        const deliveries = await this.prisma.delivery.findMany({
            where: { routeId },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        return deliveries.map((d) => this.toProps(d));
    }

    async findPendingDeliveries(limit = 100): Promise<DeliveryProps[]> {
        const deliveries = await this.prisma.delivery.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: limit,
        });
        return deliveries.map((d) => this.toProps(d));
    }

    async update(id: string, input: UpdateDeliveryInput): Promise<DeliveryProps> {
        const delivery = await this.prisma.delivery.update({
            where: { id },
            data: {
                ...(input.status !== undefined && { status: input.status }),
                ...(input.responseCode !== undefined && { responseCode: input.responseCode }),
                ...(input.responseBody !== undefined && { responseBody: input.responseBody }),
                ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
                ...(input.attempts !== undefined && { attempts: input.attempts }),
                ...(input.lastError !== undefined && { lastError: input.lastError }),
                ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
            },
        });
        return this.toProps(delivery);
    }

    async updateStatus(
        id: string,
        status: "PENDING" | "DELIVERED" | "FAILED",
        data?: Partial<UpdateDeliveryInput>,
    ): Promise<void> {
        await this.prisma.delivery.update({
            where: { id },
            data: {
                status,
                ...(data?.responseCode !== undefined && { responseCode: data.responseCode }),
                ...(data?.responseBody !== undefined && { responseBody: data.responseBody }),
                ...(data?.durationMs !== undefined && { durationMs: data.durationMs }),
                ...(data?.attempts !== undefined && { attempts: data.attempts }),
                ...(data?.lastError !== undefined && { lastError: data.lastError }),
                ...(status !== "PENDING" && { completedAt: new Date() }),
            },
        });
    }

    private toProps(delivery: Delivery): DeliveryProps {
        return {
            id: delivery.id,
            eventId: delivery.eventId,
            routeId: delivery.routeId,
            status: delivery.status,
            responseCode: delivery.responseCode,
            responseBody: delivery.responseBody,
            durationMs: delivery.durationMs,
            attempts: delivery.attempts,
            lastError: delivery.lastError,
            createdAt: delivery.createdAt,
            completedAt: delivery.completedAt,
        };
    }
}
