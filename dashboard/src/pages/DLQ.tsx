import { Card, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import { discardDLQBatch, discardDLQEvent, fetchDLQ, fetchDLQEvent } from "@/api/client";

interface DLQEvent {
    id: string;
    source: string;
    eventType: string;
    lastError: string | null;
    retryCount: number;
    createdAt: string;
}

export function DLQ() {
    const [events, setEvents] = useState<DLQEvent[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const limit = 20;

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchDLQ({ limit, offset: page * limit });
            setEvents(Array.isArray(data) ? data : (data.data ?? data.events ?? []));
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === events.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(events.map((e) => e.id)));
        }
    };

    const handleDiscard = async (id: string) => {
        await discardDLQEvent(id);
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleBatchDiscard = async () => {
        if (selected.size === 0) return;
        await discardDLQBatch(Array.from(selected));
        setEvents((prev) => prev.filter((e) => !selected.has(e.id)));
        setSelected(new Set());
    };

    const viewDetail = async (id: string) => {
        const data = await fetchDLQEvent(id);
        setDetail(data);
    };

    return (
        <>
            <PageHeader
                title="Dead Letter Queue"
                description="Events that exhausted all retry attempts"
                action={
                    selected.size > 0 ? (
                        <button
                            onClick={handleBatchDiscard}
                            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-red-500"
                        >
                            Discard {selected.size} selected
                        </button>
                    ) : undefined
                }
            />

            <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                {loading && events.length === 0 ? (
                    <div className="flex h-48 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2">
                        <p className="font-medium text-gray-400 text-lg">Queue is empty</p>
                        <p className="text-gray-600 text-sm">No dead letter events found</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-gray-800 border-b text-left text-gray-500">
                                        <th className="w-8 pr-4 pb-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.size === events.length && events.length > 0}
                                                onChange={selectAll}
                                                className="rounded border-gray-700 bg-gray-800"
                                            />
                                        </th>
                                        <th className="pr-4 pb-3 font-medium">Source</th>
                                        <th className="pr-4 pb-3 font-medium">Event Type</th>
                                        <th className="pr-4 pb-3 font-medium">Error</th>
                                        <th className="pr-4 pb-3 font-medium">Retries</th>
                                        <th className="pr-4 pb-3 font-medium">Created</th>
                                        <th className="pb-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300">
                                    {events.map((event) => (
                                        <tr
                                            key={event.id}
                                            className="border-gray-800/50 border-b transition-colors hover:bg-gray-800/30"
                                        >
                                            <td className="py-3 pr-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(event.id)}
                                                    onChange={() => toggleSelect(event.id)}
                                                    className="rounded border-gray-700 bg-gray-800"
                                                />
                                            </td>
                                            <td className="py-3 pr-4">
                                                <Badge color="topaz" size="xs">
                                                    {event.source}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-4 font-mono text-xs">{event.eventType}</td>
                                            <td className="max-w-xs truncate py-3 pr-4 text-red-400 text-xs">
                                                {event.lastError ?? "Unknown"}
                                            </td>
                                            <td className="py-3 pr-4 text-center">{event.retryCount}</td>
                                            <td className="py-3 pr-4 text-gray-500 text-xs">
                                                {new Date(event.createdAt).toLocaleString()}
                                            </td>
                                            <td className="space-x-2 py-3">
                                                <button
                                                    onClick={() => viewDetail(event.id)}
                                                    className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-xs transition-all hover:bg-gray-700 hover:text-white"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDiscard(event.id)}
                                                    className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-medium text-red-400 text-xs transition-all hover:bg-red-500/20"
                                                >
                                                    Discard
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="mt-4 flex items-center justify-between">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="rounded bg-gray-800 px-3 py-1.5 text-gray-300 text-sm hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-gray-500 text-sm">Page {page + 1}</span>
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={events.length < limit}
                                className="rounded bg-gray-800 px-3 py-1.5 text-gray-300 text-sm hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </Card>

            {/* Detail Modal */}
            {detail && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setDetail(null)}
                >
                    <div
                        className="w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <Title className="!text-white">Event Detail</Title>
                            <button onClick={() => setDetail(null)} className="text-gray-500 text-xl hover:text-white">
                                &times;
                            </button>
                        </div>
                        <pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 font-mono text-gray-300 text-xs">
                            {JSON.stringify(detail, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </>
    );
}
