import type {
    CreateSchemaInput,
    ISchemaRepository,
    SchemaDefinitionProps,
    UpdateSchemaInput,
} from "../interfaces/schema-repository.interface.js";

export interface ManageSchemaDeps {
    schemaRepository: ISchemaRepository;
}

export class ManageSchemaUseCase {
    constructor(private readonly deps: ManageSchemaDeps) {}

    async create(input: CreateSchemaInput): Promise<SchemaDefinitionProps> {
        return this.deps.schemaRepository.create(input);
    }

    async findById(id: string): Promise<SchemaDefinitionProps | null> {
        return this.deps.schemaRepository.findById(id);
    }

    async findActive(source: string, eventType: string): Promise<SchemaDefinitionProps | null> {
        return this.deps.schemaRepository.findActive(source, eventType);
    }

    async findAllBySource(source: string): Promise<SchemaDefinitionProps[]> {
        return this.deps.schemaRepository.findAllBySource(source);
    }

    async findAll(): Promise<SchemaDefinitionProps[]> {
        return this.deps.schemaRepository.findAll();
    }

    async update(id: string, input: UpdateSchemaInput): Promise<SchemaDefinitionProps> {
        return this.deps.schemaRepository.update(id, input);
    }

    async deactivate(id: string): Promise<void> {
        return this.deps.schemaRepository.deactivate(id);
    }

    async delete(id: string): Promise<void> {
        return this.deps.schemaRepository.delete(id);
    }
}
