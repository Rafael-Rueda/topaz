import { useEffect, useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

import { fetchOverview } from "@/api/client";

interface OverviewData {
    throughput: { total: number; perSecond: number; bySources: Record<string, number> };
    statusCounts: Record<string, number>;
    recentErrors: Array<{ id: string; source: string; eventType: string; lastError: string; createdAt: string }>;
    queueStats: { waiting: number; active: number; delayed: number; failed: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DELIVERED: { label: "Delivered", color: "text-emerald-400", bg: "bg-emerald-500" },
    QUEUED: { label: "Queued", color: "text-blue-400", bg: "bg-blue-500" },
    PROCESSING: { label: "Processing", color: "text-amber-400", bg: "bg-amber-500" },
    RECEIVED: { label: "Received", color: "text-slate-400", bg: "bg-slate-500" },
    FAILED: { label: "Failed", color: "text-red-400", bg: "bg-red-500" },
    DEAD: { label: "Dead", color: "text-rose-400", bg: "bg-rose-500" },
    DISCARDED: { label: "Discarded", color: "text-zinc-400", bg: "bg-zinc-500" },
};

export function Overview() {
    const [data, setData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            setLoading(true);
            const overview = await fetchOverview();
            setData(overview);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load metrics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 10_000);
        return () => clearInterval(interval);
    }, [load]);

    if (loading && !data) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
                <p className="text-red-400">{error}</p>
                <button
                    onClick={load}
                    className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const counts = data.statusCounts ?? {};
    const totalEvents = Object.values(counts).reduce((a, b) => a + b, 0);

    const statusItems = Object.entries(counts)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a);

    const sources = Object.entries(data.throughput?.bySources ?? {}).sort(([, a], [, b]) => b - a);
    const maxSource = sources.length > 0 ? sources[0][1] : 1;

    return (
        <>
            <PageHeader title="Overview" description="Real-time ingestion metrics and system health" />

            {/* Stat Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Total Events"
                    value={(data.throughput?.total ?? 0).toLocaleString()}
                    subtitle={`${(data.throughput?.perSecond ?? 0).toFixed(1)}/sec`}
                    color="amber"
                />
                <StatCard
                    title="Queue Depth"
                    value={(data.queueStats?.waiting ?? 0) + (data.queueStats?.active ?? 0)}
                    subtitle={`${data.queueStats?.waiting ?? 0} waiting, ${data.queueStats?.active ?? 0} active`}
                    color="blue"
                />
                <StatCard
                    title="Failed"
                    value={data.queueStats?.failed ?? 0}
                    color={(data.queueStats?.failed ?? 0) > 0 ? "red" : "green"}
                />
                <StatCard title="Delivered" value={(counts.DELIVERED ?? 0).toLocaleString()} color="green" />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Event Status Distribution — Custom donut-like horizontal bars */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                    <h3 className="font-medium text-sm text-white">Event Status Distribution</h3>
                    {statusItems.length === 0 ? (
                        <p className="mt-8 text-center text-gray-600 text-sm">No events yet</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {statusItems.map(([status, count]) => {
                                const cfg = STATUS_CONFIG[status] ?? {
                                    label: status,
                                    color: "text-gray-400",
                                    bg: "bg-gray-500",
                                };
                                const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
                                return (
                                    <div key={status}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${cfg.bg}`} />
                                                <span className="text-gray-300">{cfg.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-medium font-mono ${cfg.color}`}>
                                                    {count.toLocaleString()}
                                                </span>
                                                <span className="w-12 text-right text-gray-600 text-xs">
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-gray-800">
                                            <div
                                                className={`h-2 rounded-full ${cfg.bg} transition-all duration-500`}
                                                style={{ width: `${Math.max(pct, 1)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Throughput by Source — Horizontal bar chart */}
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                    <h3 className="font-medium text-sm text-white">Throughput by Source</h3>
                    <p className="mt-1 text-gray-500 text-xs">Total events per source</p>
                    {sources.length === 0 ? (
                        <p className="mt-8 text-center text-gray-600 text-sm">No events yet</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {sources.map(([source, count]) => {
                                const pct = maxSource > 0 ? (count / maxSource) * 100 : 0;
                                return (
                                    <div key={source}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className="text-gray-300">{source}</span>
                                            <span className="font-medium font-mono text-topaz-400">
                                                {count.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-gray-800">
                                            <div
                                                className="h-2 rounded-full bg-topaz-500 transition-all duration-500"
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Errors */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <h3 className="font-medium text-sm text-white">Recent Errors</h3>
                <p className="mt-1 text-gray-500 text-xs">Last failed or dead events</p>
                <div className="mt-4 overflow-x-auto">
                    {(data.recentErrors ?? []).length === 0 ? (
                        <p className="py-8 text-center text-gray-600 text-sm">No recent errors</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-gray-800 border-b text-left text-gray-500">
                                    <th className="pr-4 pb-3 font-medium">Source</th>
                                    <th className="pr-4 pb-3 font-medium">Event Type</th>
                                    <th className="pr-4 pb-3 font-medium">Error</th>
                                    <th className="pb-3 font-medium">Time</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300">
                                {(data.recentErrors ?? []).map((err) => (
                                    <tr key={err.id} className="border-gray-800/50 border-b">
                                        <td className="py-3 pr-4">
                                            <span className="rounded bg-red-500/10 px-2 py-0.5 font-medium text-red-400 text-xs">
                                                {err.source}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4 font-mono text-xs">{err.eventType}</td>
                                        <td className="max-w-xs truncate py-3 pr-4 text-red-400">{err.lastError}</td>
                                        <td className="py-3 text-gray-500">
                                            {new Date(err.createdAt).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}
