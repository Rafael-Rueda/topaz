import type {
    CreateSourceInput,
    ISourceRepository,
    SourceProps,
    UpdateSourceInput,
} from "../../../domain/ingestion/application/interfaces/source-repository.interface.js";
import type { PrismaClient, Source } from "../../../generated/prisma/client.js";

export class PrismaSourceRepository implements ISourceRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateSourceInput): Promise<SourceProps> {
        const source = await this.prisma.source.create({
            data: {
                name: input.name,
                signatureHeader: input.signatureHeader ?? null,
                signatureSecret: input.signatureSecret ?? null,
                signatureAlgorithm: input.signatureAlgorithm ?? null,
                dedupField: input.dedupField ?? null,
                dedupWindow: input.dedupWindow ?? null,
                rateLimitMax: input.rateLimitMax ?? null,
                rateLimitWindow: input.rateLimitWindow ?? null,
            },
        });
        return this.toProps(source);
    }

    async findById(id: string): Promise<SourceProps | null> {
        const source = await this.prisma.source.findUnique({ where: { id } });
        return source ? this.toProps(source) : null;
    }

    async findByName(name: string): Promise<SourceProps | null> {
        const source = await this.prisma.source.findUnique({ where: { name } });
        return source ? this.toProps(source) : null;
    }

    async findAll(): Promise<SourceProps[]> {
        const sources = await this.prisma.source.findMany({
            orderBy: { name: "asc" },
        });
        return sources.map((s) => this.toProps(s));
    }

    async findActive(): Promise<SourceProps[]> {
        const sources = await this.prisma.source.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
        });
        return sources.map((s) => this.toProps(s));
    }

    async update(id: string, input: UpdateSourceInput): Promise<SourceProps> {
        const source = await this.prisma.source.update({
            where: { id },
            data: {
                ...(input.signatureHeader !== undefined && { signatureHeader: input.signatureHeader }),
                ...(input.signatureSecret !== undefined && { signatureSecret: input.signatureSecret }),
                ...(input.signatureAlgorithm !== undefined && { signatureAlgorithm: input.signatureAlgorithm }),
                ...(input.dedupField !== undefined && { dedupField: input.dedupField }),
                ...(input.dedupWindow !== undefined && { dedupWindow: input.dedupWindow }),
                ...(input.rateLimitMax !== undefined && { rateLimitMax: input.rateLimitMax }),
                ...(input.rateLimitWindow !== undefined && { rateLimitWindow: input.rateLimitWindow }),
                ...(input.active !== undefined && { active: input.active }),
            },
        });
        return this.toProps(source);
    }

    async upsert(input: CreateSourceInput): Promise<SourceProps> {
        const source = await this.prisma.source.upsert({
            where: { name: input.name },
            create: {
                name: input.name,
                signatureHeader: input.signatureHeader ?? null,
                signatureSecret: input.signatureSecret ?? null,
                signatureAlgorithm: input.signatureAlgorithm ?? null,
                dedupField: input.dedupField ?? null,
                dedupWindow: input.dedupWindow ?? null,
                rateLimitMax: input.rateLimitMax ?? null,
                rateLimitWindow: input.rateLimitWindow ?? null,
            },
            update: {
                signatureHeader: input.signatureHeader ?? null,
                signatureSecret: input.signatureSecret ?? null,
                signatureAlgorithm: input.signatureAlgorithm ?? null,
                dedupField: input.dedupField ?? null,
                dedupWindow: input.dedupWindow ?? null,
                rateLimitMax: input.rateLimitMax ?? null,
                rateLimitWindow: input.rateLimitWindow ?? null,
            },
        });
        return this.toProps(source);
    }

    async deactivate(id: string): Promise<void> {
        await this.prisma.source.update({
            where: { id },
            data: { active: false },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.source.delete({ where: { id } });
    }

    private toProps(source: Source): SourceProps {
        return {
            id: source.id,
            name: source.name,
            signatureHeader: source.signatureHeader,
            signatureSecret: source.signatureSecret,
            signatureAlgorithm: source.signatureAlgorithm,
            dedupField: source.dedupField,
            dedupWindow: source.dedupWindow,
            rateLimitMax: source.rateLimitMax,
            rateLimitWindow: source.rateLimitWindow,
            active: source.active,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
        };
    }
}
