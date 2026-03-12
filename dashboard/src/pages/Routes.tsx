import { Card, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import {
    activateRoute,
    createRoute,
    deactivateRoute,
    deleteRoutePermenant,
    fetchRoutes,
    updateRoute,
} from "@/api/client";

interface Route {
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
    createdAt: string;
}

const priorityColors: Record<string, "red" | "amber" | "blue" | "gray"> = {
    CRITICAL: "red",
    HIGH: "amber",
    NORMAL: "blue",
    LOW: "gray",
};

export function Routes() {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editingRoute, setEditingRoute] = useState<Route | null>(null);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        source: "",
        eventType: "*",
        targetUrl: "",
        targetName: "",
        method: "POST" as "POST" | "PUT" | "PATCH",
        timeout: 5000,
        retryCount: 3,
        retryBackoff: "EXPONENTIAL" as "FIXED" | "EXPONENTIAL",
        priority: "NORMAL" as "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchRoutes();
            setRoutes(Array.isArray(data) ? data : (data.data ?? data.routes ?? []));
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createRoute(form);
            setShowCreate(false);
            setForm({
                source: "",
                eventType: "*",
                targetUrl: "",
                targetName: "",
                method: "POST",
                timeout: 5000,
                retryCount: 3,
                retryBackoff: "EXPONENTIAL",
                priority: "NORMAL",
            });
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create route");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRoute) return;
        try {
            await updateRoute(editingRoute.id, {
                targetUrl: editingRoute.targetUrl,
                targetName: editingRoute.targetName,
                method: editingRoute.method,
                timeout: editingRoute.timeout,
                retryCount: editingRoute.retryCount,
                retryBackoff: editingRoute.retryBackoff,
                priority: editingRoute.priority,
                headers: editingRoute.headers,
            });
            setEditingRoute(null);
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update route");
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            await deactivateRoute(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleActivate = async (id: string) => {
        try {
            await activateRoute(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Permanently delete this route? This cannot be undone.")) return;
        try {
            await deleteRoutePermenant(id);
        } catch {
            // silent
        }
        await load();
    };

    return (
        <>
            <PageHeader
                title="Routes"
                description="Configure where events are delivered (fan-out)"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                    >
                        Add Route
                    </button>
                }
            />

            <div className="grid gap-4">
                {loading && routes.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                        </div>
                    </Card>
                ) : routes.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <p className="text-gray-400">No routes configured</p>
                            <p className="text-gray-600 text-sm">Add one to enable event delivery</p>
                        </div>
                    </Card>
                ) : (
                    routes.map((route) => (
                        <Card key={route.id} className="!bg-gray-900 !border-gray-800 !ring-0 max-w-full overflow-hidden">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge color="topaz" size="xs">
                                            {route.source}
                                        </Badge>
                                        <span className="font-mono text-sm text-white">
                                            {route.eventType === "*" ? "* (all)" : route.eventType}
                                        </span>
                                        <Badge color={route.active ? "emerald" : "gray"} size="xs">
                                            {route.active ? "Active" : "Inactive"}
                                        </Badge>
                                        <Badge color={priorityColors[route.priority]} size="xs">
                                            {route.priority}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-gray-300 text-sm">
                                            <span className="text-gray-500">Target:</span>{" "}
                                            <span className="font-mono">{route.targetName}</span>
                                        </p>
                                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                            <p className="whitespace-nowrap text-gray-500 text-xs">
                                                {route.method} {route.targetUrl}
                                            </p>
                                        </div>
                                        <p className="text-gray-600 text-xs">
                                            Timeout: {route.timeout}ms | Retries: {route.retryCount} (
                                            {route.retryBackoff})
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                    <button
                                        onClick={() => setEditingRoute(route)}
                                        className="rounded-md border border-topaz-500/20 bg-topaz-500/10 px-3 py-1.5 font-medium text-topaz-400 text-xs transition-all hover:bg-topaz-500/20"
                                    >
                                        Edit
                                    </button>
                                    {route.active ? (
                                        <button
                                            onClick={() => handleDeactivate(route.id)}
                                            className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-400 text-xs transition-all hover:bg-amber-500/20"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(route.id)}
                                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 text-xs transition-all hover:bg-emerald-500/20"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(route.id)}
                                        className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-medium text-red-400 text-xs transition-all hover:bg-red-500/20"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Edit Modal */}
            {editingRoute && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setEditingRoute(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">Edit Route</Title>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Source</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingRoute.source}
                                        className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-gray-500 text-sm"
                                    />
                                    <p className="mt-1 text-gray-600 text-xs">Source cannot be changed</p>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Event Type</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={editingRoute.eventType}
                                        className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-gray-500 text-sm"
                                    />
                                    <p className="mt-1 text-gray-600 text-xs">Event type cannot be changed</p>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target URL</label>
                                <input
                                    type="url"
                                    required
                                    value={editingRoute.targetUrl}
                                    onChange={(e) => setEditingRoute((r) => r && { ...r, targetUrl: e.target.value })}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="https://api.example.com/webhooks"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingRoute.targetName}
                                    onChange={(e) => setEditingRoute((r) => r && { ...r, targetName: e.target.value })}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="payment-processor"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Method</label>
                                    <select
                                        value={editingRoute.method}
                                        onChange={(e) =>
                                            setEditingRoute((r) => r && { ...r, method: e.target.value as any })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Priority</label>
                                    <select
                                        value={editingRoute.priority}
                                        onChange={(e) =>
                                            setEditingRoute((r) => r && { ...r, priority: e.target.value as any })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="NORMAL">Normal</option>
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Timeout (ms)</label>
                                    <input
                                        type="number"
                                        min={1000}
                                        max={60000}
                                        value={editingRoute.timeout}
                                        onChange={(e) =>
                                            setEditingRoute((r) => r && { ...r, timeout: Number(e.target.value) })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Retry Count</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        value={editingRoute.retryCount}
                                        onChange={(e) =>
                                            setEditingRoute((r) => r && { ...r, retryCount: Number(e.target.value) })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Backoff</label>
                                    <select
                                        value={editingRoute.retryBackoff}
                                        onChange={(e) =>
                                            setEditingRoute((r) => r && { ...r, retryBackoff: e.target.value as any })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="EXPONENTIAL">Exponential</option>
                                        <option value="FIXED">Fixed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingRoute(null)}
                                    className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300 text-sm transition-colors hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowCreate(false)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">Add Route</Title>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Source</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.source}
                                        onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="stripe"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Event Type</label>
                                    <input
                                        type="text"
                                        value={form.eventType}
                                        onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="* (all)"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target URL</label>
                                <input
                                    type="url"
                                    required
                                    value={form.targetUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="https://api.example.com/webhooks"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target Name</label>
                                <input
                                    type="text"
                                    required
                                    value={form.targetName}
                                    onChange={(e) => setForm((f) => ({ ...f, targetName: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="payment-processor"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Method</label>
                                    <select
                                        value={form.method}
                                        onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as any }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="PATCH">PATCH</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as any }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="NORMAL">Normal</option>
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Timeout (ms)</label>
                                    <input
                                        type="number"
                                        min={1000}
                                        max={60000}
                                        value={form.timeout}
                                        onChange={(e) => setForm((f) => ({ ...f, timeout: Number(e.target.value) }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Retry Count</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        value={form.retryCount}
                                        onChange={(e) => setForm((f) => ({ ...f, retryCount: Number(e.target.value) }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Backoff</label>
                                    <select
                                        value={form.retryBackoff}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, retryBackoff: e.target.value as any }))
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        <option value="EXPONENTIAL">Exponential</option>
                                        <option value="FIXED">Fixed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300 text-sm transition-colors hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
