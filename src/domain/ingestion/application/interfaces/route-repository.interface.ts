export interface RouteProps {
    id: string;
    source: string;
    eventType: string;
    targetUrl: string;
    targetName: string;
    method: "POST" | "PUT" | "PATCH";
    timeout: number;
    retryCount: number;
    retryBackoff: "FIXED" | "EXPONENTIAL";
    priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers: Record<string, string> | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateRouteInput {
    source: string;
    eventType?: string;
    targetUrl: string;
    targetName: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
}

export interface UpdateRouteInput {
    targetUrl?: string;
    targetName?: string;
    method?: "POST" | "PUT" | "PATCH";
    timeout?: number;
    retryCount?: number;
    retryBackoff?: "FIXED" | "EXPONENTIAL";
    priority?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
    headers?: Record<string, string>;
    active?: boolean;
}

export interface IRouteRepository {
    create(input: CreateRouteInput): Promise<RouteProps>;
    findById(id: string): Promise<RouteProps | null>;
    findBySource(source: string): Promise<RouteProps[]>;
    findBySourceAndEventType(source: string, eventType: string): Promise<RouteProps[]>;
    findAll(): Promise<RouteProps[]>;
    update(id: string, input: UpdateRouteInput): Promise<RouteProps>;
    deactivate(id: string): Promise<void>;
    delete(id: string): Promise<void>;
}
