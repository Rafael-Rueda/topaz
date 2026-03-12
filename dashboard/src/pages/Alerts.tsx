import { Card, Title } from "@tremor/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import { createAlert, deleteAlert, fetchAlertHistory, fetchAlerts, updateAlert } from "@/api/client";

interface AlertRule {
    id: string;
    name: string;
    metric: string;
    threshold: number;
    window: string;
    cooldown: string;
    targetUrl: string;
    active: boolean;
    createdAt: string;
}

interface AlertHistoryEntry {
    id: string;
    alertRuleId: string;
    metricValue: number;
    message: string;
    firedAt: string;
}

const METRICS = ["ERROR_RATE", "QUEUE_SIZE", "LATENCY_P95", "DLQ_SIZE", "SCHEMA_DRIFT"] as const;

const metricColors: Record<string, string> = {
    ERROR_RATE: "red",
    QUEUE_SIZE: "blue",
    LATENCY_P95: "amber",
    DLQ_SIZE: "red",
    SCHEMA_DRIFT: "gray",
};

export function Alerts() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
    const [tab, setTab] = useState<"rules" | "history">("rules");
    const [loading, setLoading] = useState(true);

    // Form state
    const [form, setForm] = useState({
        name: "",
        metric: "ERROR_RATE" as string,
        threshold: 0,
        window: "5m",
        targetUrl: "",
        cooldown: "15m",
    });

    const load = async () => {
        try {
            setLoading(true);
            const [rulesData, historyData] = await Promise.all([fetchAlerts(), fetchAlertHistory({ limit: 50 })]);
            setRules(Array.isArray(rulesData) ? rulesData : (rulesData.data ?? rulesData.rules ?? []));
            setHistory(Array.isArray(historyData) ? historyData : (historyData.data ?? historyData.history ?? []));
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await createAlert(form);
        setShowCreate(false);
        setForm({ name: "", metric: "ERROR_RATE", threshold: 0, window: "5m", targetUrl: "", cooldown: "15m" });
        load();
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRule) return;
        try {
            await updateAlert(editingRule.id, {
                name: editingRule.name,
                threshold: editingRule.threshold,
                window: editingRule.window,
                targetUrl: editingRule.targetUrl,
                cooldown: editingRule.cooldown,
            });
            setEditingRule(null);
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update alert");
        }
    };

    const handleDelete = async (id: string) => {
        await deleteAlert(id);
        load();
    };

    return (
        <>
            <PageHeader
                title="Alerts"
                description="Configure alert rules and view firing history"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                    >
                        Create Rule
                    </button>
                }
            />

            {/* Tabs */}
            <div className="mb-6 flex w-fit gap-1 rounded-lg border border-gray-800 bg-gray-900 p-1">
                {(["rules", "history"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`rounded-md px-4 py-2 font-medium text-sm transition-colors ${
                            tab === t ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                        {t === "rules" ? "Rules" : "History"}
                    </button>
                ))}
            </div>

            {tab === "rules" && (
                <div className="grid gap-4">
                    {loading && rules.length === 0 ? (
                        <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                            <div className="flex h-32 items-center justify-center">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                            </div>
                        </Card>
                    ) : rules.length === 0 ? (
                        <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                            <div className="flex h-32 flex-col items-center justify-center gap-2">
                                <p className="text-gray-400">No alert rules configured</p>
                                <p className="text-gray-600 text-sm">Create one to start monitoring</p>
                            </div>
                        </Card>
                    ) : (
                        rules.map((rule) => (
                            <Card key={rule.id} className="!bg-gray-900 !border-gray-800 !ring-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-white">{rule.name}</h3>
                                                <Badge color={rule.active ? "emerald" : "gray"} size="xs">
                                                    {rule.active ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex items-center gap-3 text-gray-500 text-sm">
                                                <Badge
                                                    color={
                                                        (metricColors[rule.metric] ?? "gray") as
                                                            | "red"
                                                            | "blue"
                                                            | "amber"
                                                            | "gray"
                                                    }
                                                    size="xs"
                                                >
                                                    {rule.metric}
                                                </Badge>
                                                <span>Threshold: {rule.threshold}</span>
                                                <span>Window: {rule.window}</span>
                                                <span>Cooldown: {rule.cooldown}</span>
                                            </div>
                                            <p className="mt-1 max-w-md truncate font-mono text-gray-600 text-xs">
                                                {rule.targetUrl}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingRule(rule)}
                                        className="rounded-md border border-topaz-500/20 bg-topaz-500/10 px-3 py-1.5 font-medium text-topaz-400 text-xs transition-all hover:bg-topaz-500/20"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id)}
                                        className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 font-medium text-red-400 text-xs transition-all hover:bg-red-500/20"
                                    >
                                        Deactivate
                                    </button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {tab === "history" && (
                <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                    <Title className="!text-white">Firing History</Title>
                    {history.length === 0 ? (
                        <p className="py-8 text-center text-gray-600 text-sm">No alerts have fired yet</p>
                    ) : (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-gray-800 border-b text-left text-gray-500">
                                        <th className="pr-4 pb-3 font-medium">Message</th>
                                        <th className="pr-4 pb-3 font-medium">Value</th>
                                        <th className="pb-3 font-medium">Fired At</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300">
                                    {history.map((entry) => (
                                        <tr key={entry.id} className="border-gray-800/50 border-b">
                                            <td className="max-w-md truncate py-3 pr-4">{entry.message}</td>
                                            <td className="py-3 pr-4 font-mono text-topaz-400">{entry.metricValue}</td>
                                            <td className="py-3 text-gray-500 text-xs">
                                                {new Date(entry.firedAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Edit Modal */}
            {editingRule && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setEditingRule(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">Edit Alert Rule</Title>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingRule.name}
                                    onChange={(e) => setEditingRule((r) => r && { ...r, name: e.target.value })}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="High error rate alert"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Metric</label>
                                    <select
                                        disabled
                                        value={editingRule.metric}
                                        className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-gray-500 text-sm"
                                    >
                                        {METRICS.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-gray-600 text-xs">Metric cannot be changed</p>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Threshold</label>
                                    <input
                                        type="number"
                                        required
                                        step="any"
                                        value={editingRule.threshold}
                                        onChange={(e) =>
                                            setEditingRule((r) => r && { ...r, threshold: Number(e.target.value) })
                                        }
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Window</label>
                                    <input
                                        type="text"
                                        required
                                        value={editingRule.window}
                                        onChange={(e) => setEditingRule((r) => r && { ...r, window: e.target.value })}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="5m"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Cooldown</label>
                                    <input
                                        type="text"
                                        value={editingRule.cooldown}
                                        onChange={(e) => setEditingRule((r) => r && { ...r, cooldown: e.target.value })}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="15m"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target URL (webhook)</label>
                                <input
                                    type="url"
                                    required
                                    value={editingRule.targetUrl}
                                    onChange={(e) => setEditingRule((r) => r && { ...r, targetUrl: e.target.value })}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="https://hooks.slack.com/..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingRule(null)}
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
                        className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">Create Alert Rule</Title>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="High error rate alert"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Metric</label>
                                    <select
                                        value={form.metric}
                                        onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    >
                                        {METRICS.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Threshold</label>
                                    <input
                                        type="number"
                                        required
                                        step="any"
                                        value={form.threshold}
                                        onChange={(e) => setForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Window</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.window}
                                        onChange={(e) => setForm((f) => ({ ...f, window: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="5m"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Cooldown</label>
                                    <input
                                        type="text"
                                        value={form.cooldown}
                                        onChange={(e) => setForm((f) => ({ ...f, cooldown: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="15m"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Target URL (webhook)</label>
                                <input
                                    type="url"
                                    required
                                    value={form.targetUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, targetUrl: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder="https://hooks.slack.com/..."
                                />
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
