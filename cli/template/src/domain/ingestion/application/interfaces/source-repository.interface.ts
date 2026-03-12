export interface SourceProps {
    id: string;
    name: string;
    signatureHeader: string | null;
    signatureSecret: string | null;
    signatureAlgorithm: "HMAC_SHA256" | "HMAC_SHA512" | null;
    dedupField: string | null;
    dedupWindow: string | null;
    rateLimitMax: number | null;
    rateLimitWindow: number | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSourceInput {
    name: string;
    signatureHeader?: string;
    signatureSecret?: string;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512";
    dedupField?: string;
    dedupWindow?: string;
    rateLimitMax?: number;
    rateLimitWindow?: number;
}

export interface UpdateSourceInput {
    signatureHeader?: string | null;
    signatureSecret?: string | null;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512" | null;
    dedupField?: string | null;
    dedupWindow?: string | null;
    rateLimitMax?: number | null;
    rateLimitWindow?: number | null;
    active?: boolean;
}

export interface ISourceRepository {
    create(input: CreateSourceInput): Promise<SourceProps>;
    findById(id: string): Promise<SourceProps | null>;
    findByName(name: string): Promise<SourceProps | null>;
    findAll(): Promise<SourceProps[]>;
    findActive(): Promise<SourceProps[]>;
    update(id: string, input: UpdateSourceInput): Promise<SourceProps>;
    upsert(input: CreateSourceInput): Promise<SourceProps>;
    deactivate(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}
