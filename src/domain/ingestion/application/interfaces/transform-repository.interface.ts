export interface TransformProps {
    id: string;
    source: string;
    eventType: string;
    mapping: Record<string, string>;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTransformInput {
    source: string;
    eventType: string;
    mapping: Record<string, string>;
}

export interface UpdateTransformInput {
    mapping?: Record<string, string>;
    active?: boolean;
}

export interface ITransformRepository {
    create(input: CreateTransformInput): Promise<TransformProps>;
    findById(id: string): Promise<TransformProps | null>;
    findActive(source: string, eventType: string): Promise<TransformProps | null>;
    findBySource(source: string): Promise<TransformProps[]>;
    findAll(): Promise<TransformProps[]>;
    update(id: string, input: UpdateTransformInput): Promise<TransformProps>;
    upsert(input: CreateTransformInput): Promise<TransformProps>;
    deactivate(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}
