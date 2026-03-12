import type {
    CreateTransformInput,
    ITransformRepository,
    TransformProps,
    UpdateTransformInput,
} from "../../../domain/ingestion/application/interfaces/transform-repository.interface.js";
import type { PrismaClient, Transform } from "../../../generated/prisma/client.js";

export class PrismaTransformRepository implements ITransformRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateTransformInput): Promise<TransformProps> {
        const transform = await this.prisma.transform.create({
            data: {
                source: input.source,
                eventType: input.eventType,
                mapping: input.mapping as object,
            },
        });
        return this.toProps(transform);
    }

    async findById(id: string): Promise<TransformProps | null> {
        const transform = await this.prisma.transform.findUnique({ where: { id } });
        return transform ? this.toProps(transform) : null;
    }

    async findActive(source: string, eventType: string): Promise<TransformProps | null> {
        // Try exact match first, then wildcard
        const transform = await this.prisma.transform.findFirst({
            where: {
                source,
                active: true,
                OR: [{ eventType }, { eventType: "*" }],
            },
            orderBy: { eventType: "desc" }, // exact match ("desc") sorts specific before "*"
        });
        return transform ? this.toProps(transform) : null;
    }

    async findBySource(source: string): Promise<TransformProps[]> {
        const transforms = await this.prisma.transform.findMany({
            where: { source },
            orderBy: { createdAt: "desc" },
        });
        return transforms.map((t) => this.toProps(t));
    }

    async findAll(): Promise<TransformProps[]> {
        const transforms = await this.prisma.transform.findMany({
            orderBy: [{ source: "asc" }, { eventType: "asc" }],
        });
        return transforms.map((t) => this.toProps(t));
    }

    async update(id: string, input: UpdateTransformInput): Promise<TransformProps> {
        const transform = await this.prisma.transform.update({
            where: { id },
            data: {
                ...(input.mapping !== undefined && { mapping: input.mapping as object }),
                ...(input.active !== undefined && { active: input.active }),
            },
        });
        return this.toProps(transform);
    }

    async upsert(input: CreateTransformInput): Promise<TransformProps> {
        const transform = await this.prisma.transform.upsert({
            where: {
                source_eventType: {
                    source: input.source,
                    eventType: input.eventType,
                },
            },
            create: {
                source: input.source,
                eventType: input.eventType,
                mapping: input.mapping as object,
            },
            update: {
                mapping: input.mapping as object,
                active: true,
            },
        });
        return this.toProps(transform);
    }

    async deactivate(id: string): Promise<void> {
        await this.prisma.transform.update({
            where: { id },
            data: { active: false },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.transform.delete({ where: { id } });
    }

    private toProps(transform: Transform): TransformProps {
        return {
            id: transform.id,
            source: transform.source,
            eventType: transform.eventType,
            mapping: transform.mapping as Record<string, string>,
            active: transform.active,
            createdAt: transform.createdAt,
            updatedAt: transform.updatedAt,
        };
    }
}
