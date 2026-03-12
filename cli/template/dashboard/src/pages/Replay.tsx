import { Card, ProgressBar, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import { cancelReplay, executeReplay, fetchReplayHistory, previewReplay } from "@/api/client";

interface ReplayRequest {
    id: string;
    status: string;
    totalEvents: number;
    replayedEvents: number;
    filterSource?: string | null;
    filterEventType?: string | null;
    filterStatus?: string | null;
    filterFrom?: string | null;
    filterTo?: string | null;
    createdAt: string;
    completedAt: string | null;
}

const statusColors: Record<string, "gray" | "blue" | "emerald" | "amber" | "red"> = {
    PENDING: "gray",
    IN_PROGRESS: "blue",
    COMPLETED: "emerald",
    CANCELLED: "amber",
    FAILED: "red",
};

export function Replay() {
    const [replays, setReplays] = useState<ReplayRequest[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);

    // Filter form
    const [filters, setFilters] = useState({
        source: "",
        eventType: "",
        status: "FAILED",
        from: "",
        to: "",
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchReplayHistory();
            setReplays(Array.isArray(data) ? data : (data.data ?? data.replays ?? []));
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 5_000);
        return () => clearInterval(interval);
    }, [load]);

    const buildFilters = () => {
        const f: Record<string, unknown> = {};
        if (filters.source?.trim()) f.filterSource = filters.source.trim();
        if (filters.eventType?.trim()) f.filterEventType = filters.eventType.trim();
        if (filters.status) f.filterStatus = filters.status;
        if (filters.from) f.filterFrom = new Date(filters.from).toISOString();
        if (filters.to) f.filterTo = new Date(filters.to).toISOString();
        return f;
    };

    const handlePreview = async () => {
        const data = await previewReplay(buildFilters());
        setPreviewCount(data.count ?? data.totalEvents ?? 0);
    };

    const handleExecute = async () => {
        setExecuting(true);
        try {
            await executeReplay({ ...buildFilters(), requestedBy: "dashboard-user" });
            setShowCreate(false);
            setPreviewCount(null);
            load();
        } finally {
            setExecuting(false);
        }
    };

    const handleCancel = async (id: string) => {
        await cancelReplay(id);
        load();
    };

    return (
        <>
            <PageHeader
                title="Replay"
                description="Re-process failed or filtered events"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                    >
                        New Replay
                    </button>
                }
            />

            {/* Replay History */}
            <div className="grid gap-4">
                {loading && replays.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                        </div>
                    </Card>
                ) : replays.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <p className="text-gray-400">No replay requests</p>
                            <p className="text-gray-600 text-sm">Create one to re-process events</p>
                        </div>
                    </Card>
                ) : (
                    replays.map((replay) => {
                        const progress =
                            replay.totalEvents > 0 ? (replay.replayedEvents / replay.totalEvents) * 100 : 0;

                        return (
                            <Card key={replay.id} className="!bg-gray-900 !border-gray-800 !ring-0">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-mono text-gray-500 text-xs">
                                                {replay.id.slice(0, 8)}...
                                            </p>
                                            <Badge color={statusColors[replay.status] ?? "gray"} size="xs">
                                                {replay.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-2 flex items-center gap-4 text-gray-500 text-sm">
                                            <span>
                                                {replay.replayedEvents} / {replay.totalEvents} events
                                            </span>
                                            <span>{new Date(replay.createdAt).toLocaleString()}</span>
                                        </div>
                                        {replay.status === "IN_PROGRESS" && (
                                            <ProgressBar value={progress} color="amber" className="mt-3" />
                                        )}
                                        {(replay.filterSource || replay.filterEventType || replay.filterStatus) && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {replay.filterSource && (
                                                    <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-400 text-xs">
                                                        source: {replay.filterSource}
                                                    </span>
                                                )}
                                                {replay.filterEventType && (
                                                    <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-400 text-xs">
                                                        eventType: {replay.filterEventType}
                                                    </span>
                                                )}
                                                {replay.filterStatus && (
                                                    <span className="rounded bg-gray-800 px-2 py-0.5 text-gray-400 text-xs">
                                                        status: {replay.filterStatus}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {replay.status === "IN_PROGRESS" && (
                                        <button
                                            onClick={() => handleCancel(replay.id)}
                                            className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-medium text-red-400 text-xs transition-all hover:bg-red-500/20"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowCreate(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">New Replay</Title>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Source</label>
                                    <input
                                        type="text"
                                        value={filters.source}
                                        onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="stripe"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Event Type</label>
                                    <input
                                        type="text"
                                        value={filters.eventType}
                                        onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="payment_intent.succeeded"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Status Filter</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                >
                                    <option value="FAILED">FAILED</option>
                                    <option value="DEAD">DEAD</option>
                                    <option value="DELIVERED">DELIVERED</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">From</label>
                                    <input
                                        type="datetime-local"
                                        value={filters.from}
                                        onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">To</label>
                                    <input
                                        type="datetime-local"
                                        value={filters.to}
                                        onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {previewCount !== null && (
                                <div className="rounded-lg border border-topaz-800/30 bg-topaz-900/20 px-4 py-3">
                                    <p className="text-sm text-topaz-400">
                                        <strong>{previewCount}</strong> events match these filters
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreate(false);
                                        setPreviewCount(null);
                                    }}
                                    className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300 text-sm transition-colors hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePreview}
                                    className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-600"
                                >
                                    Preview
                                </button>
                                <button
                                    onClick={handleExecute}
                                    disabled={executing}
                                    className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500 disabled:opacity-50"
                                >
                                    {executing ? "Executing..." : "Execute Replay"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
