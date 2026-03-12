import type {
    CreateRouteInput,
    IRouteRepository,
    RouteProps,
    UpdateRouteInput,
} from "../../../domain/ingestion/application/interfaces/route-repository.interface.js";
import type { PrismaClient, Route } from "../../../generated/prisma/client.js";

export class PrismaRouteRepository implements IRouteRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateRouteInput): Promise<RouteProps> {
        const route = await this.prisma.route.create({
            data: {
                source: input.source,
                eventType: input.eventType ?? "*",
                targetUrl: input.targetUrl,
                targetName: input.targetName,
                method: input.method ?? "POST",
                timeout: input.timeout ?? 5000,
                retryCount: input.retryCount ?? 3,
                retryBackoff: input.retryBackoff ?? "EXPONENTIAL",
                priority: input.priority ?? "NORMAL",
                headers: input.headers ?? {},
            },
        });
        return this.toProps(route);
    }

    async findById(id: string): Promise<RouteProps | null> {
        const route = await this.prisma.route.findUnique({ where: { id } });
        return route ? this.toProps(route) : null;
    }

    async findBySource(source: string): Promise<RouteProps[]> {
        const routes = await this.prisma.route.findMany({
            where: { source, active: true },
            orderBy: { createdAt: "desc" },
        });
        return routes.map((r) => this.toProps(r));
    }

    async findBySourceAndEventType(source: string, eventType: string): Promise<RouteProps[]> {
        const routes = await this.prisma.route.findMany({
            where: {
                source,
                active: true,
                OR: [{ eventType: "*" }, { eventType }],
            },
            orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        });
        return routes.map((r) => this.toProps(r));
    }

    async findAll(): Promise<RouteProps[]> {
        const routes = await this.prisma.route.findMany({
            orderBy: [{ source: "asc" }, { createdAt: "desc" }],
        });
        return routes.map((r) => this.toProps(r));
    }

    async update(id: string, input: UpdateRouteInput): Promise<RouteProps> {
        const route = await this.prisma.route.update({
            where: { id },
            data: {
                ...(input.targetUrl !== undefined && { targetUrl: input.targetUrl }),
                ...(input.targetName !== undefined && { targetName: input.targetName }),
                ...(input.method !== undefined && { method: input.method }),
                ...(input.timeout !== undefined && { timeout: input.timeout }),
                ...(input.retryCount !== undefined && { retryCount: input.retryCount }),
                ...(input.retryBackoff !== undefined && { retryBackoff: input.retryBackoff }),
                ...(input.priority !== undefined && { priority: input.priority }),
                ...(input.headers !== undefined && { headers: input.headers }),
                ...(input.active !== undefined && { active: input.active }),
            },
        });
        return this.toProps(route);
    }

    async deactivate(id: string): Promise<void> {
        await this.prisma.route.update({
            where: { id },
            data: { active: false },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.route.delete({ where: { id } });
    }

    private toProps(route: Route): RouteProps {
        return {
            id: route.id,
            source: route.source,
            eventType: route.eventType,
            targetUrl: route.targetUrl,
            targetName: route.targetName,
            method: route.method,
            timeout: route.timeout,
            retryCount: route.retryCount,
            retryBackoff: route.retryBackoff,
            priority: route.priority,
            headers: route.headers as Record<string, string> | null,
            active: route.active,
            createdAt: route.createdAt,
            updatedAt: route.updatedAt,
        };
    }
}
