export interface SchemaDefinitionProps {
    id: string;
    source: string;
    eventType: string;
    version: number;
    schema: object;
    rejectOnFail: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSchemaInput {
    source: string;
    eventType: string;
    schema: object;
    rejectOnFail?: boolean;
}

export interface UpdateSchemaInput {
    schema?: object;
    rejectOnFail?: boolean;
    active?: boolean;
}

export interface ISchemaRepository {
    create(input: CreateSchemaInput): Promise<SchemaDefinitionProps>;
    findById(id: string): Promise<SchemaDefinitionProps | null>;
    findActive(source: string, eventType: string): Promise<SchemaDefinitionProps | null>;
    findAllBySource(source: string): Promise<SchemaDefinitionProps[]>;
    findAll(): Promise<SchemaDefinitionProps[]>;
    update(id: string, input: UpdateSchemaInput): Promise<SchemaDefinitionProps>;
    deactivate(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}
