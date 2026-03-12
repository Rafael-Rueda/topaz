import type {
    CreateSchemaInput,
    ISchemaRepository,
    SchemaDefinitionProps,
    UpdateSchemaInput,
} from "../../../domain/ingestion/application/interfaces/schema-repository.interface.js";
import type { PrismaClient, SchemaDefinition } from "../../../generated/prisma/client.js";

export class PrismaSchemaRepository implements ISchemaRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateSchemaInput): Promise<SchemaDefinitionProps> {
        // Find the latest version to auto-increment
        const latest = await this.prisma.schemaDefinition.findFirst({
            where: { source: input.source, eventType: input.eventType },
            orderBy: { version: "desc" },
        });

        const nextVersion = (latest?.version ?? 0) + 1;

        // Deactivate previous versions
        if (latest) {
            await this.prisma.schemaDefinition.updateMany({
                where: { source: input.source, eventType: input.eventType, active: true },
                data: { active: false },
            });
        }

        const schema = await this.prisma.schemaDefinition.create({
            data: {
                source: input.source,
                eventType: input.eventType,
                version: nextVersion,
                schema: input.schema as object,
                rejectOnFail: input.rejectOnFail ?? false,
            },
        });

        return this.toProps(schema);
    }

    async findById(id: string): Promise<SchemaDefinitionProps | null> {
        const schema = await this.prisma.schemaDefinition.findUnique({ where: { id } });
        return schema ? this.toProps(schema) : null;
    }

    async findActive(source: string, eventType: string): Promise<SchemaDefinitionProps | null> {
        const schema = await this.prisma.schemaDefinition.findFirst({
            where: { source, eventType, active: true },
            orderBy: { version: "desc" },
        });
        return schema ? this.toProps(schema) : null;
    }

    async findAllBySource(source: string): Promise<SchemaDefinitionProps[]> {
        const schemas = await this.prisma.schemaDefinition.findMany({
            where: { source },
            orderBy: [{ eventType: "asc" }, { version: "desc" }],
        });
        return schemas.map((s) => this.toProps(s));
    }

    async findAll(): Promise<SchemaDefinitionProps[]> {
        const schemas = await this.prisma.schemaDefinition.findMany({
            orderBy: [{ source: "asc" }, { eventType: "asc" }, { version: "desc" }],
        });
        return schemas.map((s) => this.toProps(s));
    }

    async update(id: string, input: UpdateSchemaInput): Promise<SchemaDefinitionProps> {
        const schema = await this.prisma.schemaDefinition.update({
            where: { id },
            data: {
                ...(input.schema !== undefined && { schema: input.schema as object }),
                ...(input.rejectOnFail !== undefined && { rejectOnFail: input.rejectOnFail }),
                ...(input.active !== undefined && { active: input.active }),
            },
        });
        return this.toProps(schema);
    }

    async deactivate(id: string): Promise<void> {
        await this.prisma.schemaDefinition.update({
            where: { id },
            data: { active: false },
        });
    }

    async delete(id: string): Promise<void> {
        await this.prisma.schemaDefinition.delete({
            where: { id },
        });
    }

    private toProps(schema: SchemaDefinition): SchemaDefinitionProps {
        return {
            id: schema.id,
            source: schema.source,
            eventType: schema.eventType,
            version: schema.version,
            schema: schema.schema as object,
            rejectOnFail: schema.rejectOnFail,
            active: schema.active,
            createdAt: schema.createdAt,
            updatedAt: schema.updatedAt,
        };
    }
}
