import axios from "axios";

const api = axios.create({
    baseURL: "/api",
    timeout: 10_000,
    headers: { "Content-Type": "application/json" },
});

// ── Metrics ──────────────────────────────────────────────
export const fetchOverview = () => api.get("/metrics/overview").then((r) => r.data);
export const fetchThroughput = () => api.get("/metrics/throughput").then((r) => r.data);
export const fetchLatency = () => api.get("/metrics/latency").then((r) => r.data);
export const fetchErrors = () => api.get("/metrics/errors").then((r) => r.data);
export const fetchQueues = () => api.get("/metrics/queues").then((r) => r.data);

// ── DLQ ──────────────────────────────────────────────────
export const fetchDLQ = (params?: { source?: string; eventType?: string; limit?: number; offset?: number }) =>
    api.get("/dlq", { params }).then((r) => r.data);
export const fetchDLQEvent = (id: string) => api.get(`/dlq/${id}`).then((r) => r.data);
export const discardDLQEvent = (id: string) => api.post(`/dlq/${id}/discard`).then((r) => r.data);
export const discardDLQBatch = (ids: string[]) => api.post("/dlq/discard", { ids }).then((r) => r.data);

// ── Alerts ───────────────────────────────────────────────
export const fetchAlerts = () => api.get("/alerts").then((r) => r.data);
export const createAlert = (data: {
    name: string;
    metric: string;
    threshold: number;
    window: string;
    targetUrl: string;
    cooldown?: string;
}) => api.post("/alerts", data).then((r) => r.data);
export const updateAlert = (id: string, data: Record<string, unknown>) =>
    api.put(`/alerts/${id}`, data).then((r) => r.data);
export const deleteAlert = (id: string) => api.delete(`/alerts/${id}`);
export const activateAlert = (id: string) => api.put(`/alerts/${id}`, { active: true });
export const deleteAlertPermanent = (id: string) => api.delete(`/alerts/${id}/permanent`);
export const fetchAlertHistory = (params?: { alertRuleId?: string; limit?: number }) =>
    api.get("/alerts/history", { params }).then((r) => r.data);

// ── Replay ───────────────────────────────────────────────
export const previewReplay = (filters: Record<string, unknown>) =>
    api.post("/replay/preview", filters).then((r) => r.data);
export const executeReplay = (filters: Record<string, unknown>) =>
    api.post("/replay/execute", filters).then((r) => r.data);
export const fetchReplayHistory = () => api.get("/replay/history").then((r) => r.data);
export const fetchReplay = (id: string) => api.get(`/replay/${id}`).then((r) => r.data);
export const cancelReplay = (id: string) => api.post(`/replay/${id}/cancel`).then((r) => r.data);

// ── Routes ───────────────────────────────────────────────
export const fetchRoutes = () => api.get("/routes").then((r) => r.data);
export const createRoute = (data: {
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
}) => api.post("/routes", data).then((r) => r.data);
export const updateRoute = (id: string, data: Record<string, unknown>) =>
    api.put(`/routes/${id}`, data).then((r) => r.data);
export const deactivateRoute = (id: string) => api.delete(`/routes/${id}`);
export const activateRoute = (id: string) => api.post(`/routes/${id}/activate`);
export const deleteRoutePermenant = (id: string) => api.delete(`/routes/${id}/permanent`);

// ── Schemas ──────────────────────────────────────────────
export const fetchSchemas = () => api.get("/schemas").then((r) => r.data);
export const createSchema = (data: { source: string; eventType: string; jsonSchema: object; rejectOnFail?: boolean }) =>
    api
        .post("/schemas", {
            source: data.source,
            eventType: data.eventType,
            schema: data.jsonSchema,
            rejectOnFail: data.rejectOnFail,
        })
        .then((r) => r.data);
export const updateSchema = (id: string, data: Record<string, unknown>) =>
    api.put(`/schemas/${id}`, data).then((r) => r.data);
export const activateSchema = (id: string) => api.put(`/schemas/${id}`, { active: true }).then((r) => r.data);
export const deactivateSchema = (id: string) => api.delete(`/schemas/${id}`);
export const deleteSchemaPermenant = (id: string) => api.delete(`/schemas/${id}/permanent`);

// ── Transforms ───────────────────────────────────────────
export const fetchTransforms = () => api.get("/transforms").then((r) => r.data);
export const fetchTransform = (id: string) => api.get(`/transforms/${id}`).then((r) => r.data);
export const createTransform = (data: { source: string; eventType: string; mapping: Record<string, string> }) =>
    api.post("/transforms", data).then((r) => r.data);
export const updateTransform = (id: string, data: { mapping?: Record<string, string>; active?: boolean }) =>
    api.put(`/transforms/${id}`, data).then((r) => r.data);
export const deactivateTransform = (id: string) => api.delete(`/transforms/${id}`);
export const activateTransform = (id: string) => api.post(`/transforms/${id}/activate`);
export const deleteTransformPermenant = (id: string) => api.delete(`/transforms/${id}/permanent`);
export const testTransform = (data: { source: string; eventType: string; payload: unknown }) =>
    api.post("/transforms/test", data).then((r) => r.data);

// ── Sources ──────────────────────────────────────────────
export const fetchSources = () => api.get("/sources").then((r) => r.data);
export const fetchSource = (id: string) => api.get(`/sources/${id}`).then((r) => r.data);
export const createSource = (data: {
    name: string;
    signatureHeader?: string;
    signatureSecret?: string;
    signatureAlgorithm?: "HMAC_SHA256" | "HMAC_SHA512";
    dedupField?: string;
    dedupWindow?: string;
    rateLimitMax?: number;
    rateLimitWindow?: number;
}) => api.post("/sources", data).then((r) => r.data);
export const updateSource = (id: string, data: Record<string, unknown>) =>
    api.put(`/sources/${id}`, data).then((r) => r.data);
export const deactivateSource = (id: string) => api.delete(`/sources/${id}`);
export const deleteSourcePermenant = (id: string) => api.delete(`/sources/${id}/permanent`);

export default api;
