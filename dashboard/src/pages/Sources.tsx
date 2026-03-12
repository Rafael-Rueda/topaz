import { Card, Title } from "@tremor/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import { createSource, deactivateSource, deleteSourcePermenant, fetchSources, updateSource } from "@/api/client";

interface Source {
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
    createdAt: string;
    updatedAt: string;
}

export function Sources() {
    const [sources, setSources] = useState<Source[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const [form, setForm] = useState({
        name: "",
        signatureHeader: "",
        signatureSecret: "",
        signatureAlgorithm: "" as "HMAC_SHA256" | "HMAC_SHA512" | "",
        dedupField: "",
        dedupWindow: "72h",
        rateLimitMax: "",
        rateLimitWindow: "",
    });

    const load = async () => {
        try {
            setLoading(true);
            const data = await fetchSources();
            setSources(Array.isArray(data) ? data : (data.data ?? []));
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
        try {
            await createSource({
                name: form.name,
                signatureHeader: form.signatureHeader || undefined,
                signatureSecret: form.signatureSecret || undefined,
                signatureAlgorithm: form.signatureAlgorithm || undefined,
                dedupField: form.dedupField || undefined,
                dedupWindow: form.dedupWindow || undefined,
                rateLimitMax: form.rateLimitMax ? Number(form.rateLimitMax) : undefined,
                rateLimitWindow: form.rateLimitWindow ? Number(form.rateLimitWindow) : undefined,
            });
            setShowCreate(false);
            resetForm();
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create source");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        try {
            await updateSource(editingId, {
                signatureHeader: form.signatureHeader || null,
                signatureSecret: form.signatureSecret || null,
                signatureAlgorithm: form.signatureAlgorithm || null,
                dedupField: form.dedupField || null,
                dedupWindow: form.dedupWindow || null,
                rateLimitMax: form.rateLimitMax ? Number(form.rateLimitMax) : null,
                rateLimitWindow: form.rateLimitWindow ? Number(form.rateLimitWindow) : null,
            });
            setEditingId(null);
            resetForm();
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update source");
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            await deactivateSource(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleActivate = async (id: string) => {
        try {
            await updateSource(id, { active: true });
        } catch {
            // silent
        }
        await load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Permanently delete this source? This cannot be undone.")) return;
        try {
            await deleteSourcePermenant(id);
        } catch {
            // silent
        }
        await load();
    };

    const startEdit = (s: Source) => {
        setEditingId(s.id);
        setForm({
            name: s.name,
            signatureHeader: s.signatureHeader ?? "",
            signatureSecret: "",
            signatureAlgorithm: s.signatureAlgorithm ?? "",
            dedupField: s.dedupField ?? "",
            dedupWindow: s.dedupWindow ?? "72h",
            rateLimitMax: s.rateLimitMax?.toString() ?? "",
            rateLimitWindow: s.rateLimitWindow?.toString() ?? "",
        });
    };

    const resetForm = () => {
        setForm({
            name: "",
            signatureHeader: "",
            signatureSecret: "",
            signatureAlgorithm: "",
            dedupField: "",
            dedupWindow: "72h",
            rateLimitMax: "",
            rateLimitWindow: "",
        });
        setShowHelp(false);
    };

    return (
        <>
            <PageHeader
                title="Sources"
                description="Configure webhook sources (Stripe, etc.)"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                    >
                        Add Source
                    </button>
                }
            />

            <div className="grid gap-4">
                {loading && sources.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                        </div>
                    </Card>
                ) : sources.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <p className="text-gray-400">No sources configured</p>
                            <p className="text-gray-600 text-sm">Add one to enable webhook ingestion</p>
                        </div>
                    </Card>
                ) : (
                    sources.map((s) => (
                        <Card key={s.id} className="!bg-gray-900 !border-gray-800 !ring-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge color="topaz" size="xs">
                                            {s.name}
                                        </Badge>
                                        <Badge color={s.active ? "emerald" : "gray"} size="xs">
                                            {s.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-gray-500">Signature Header:</span>{" "}
                                            <span className="text-gray-300">{s.signatureHeader ?? "—"}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Algorithm:</span>{" "}
                                            <span className="text-gray-300">{s.signatureAlgorithm ?? "—"}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Deduplication:</span>{" "}
                                            <span className="text-gray-300">
                                                {s.dedupField ? `${s.dedupField} (${s.dedupWindow})` : "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Rate Limit:</span>{" "}
                                            <span className="text-gray-300">
                                                {s.rateLimitMax
                                                    ? `${s.rateLimitMax} req / ${s.rateLimitWindow}ms`
                                                    : "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                        onClick={() => startEdit(s)}
                                        className="rounded-md border border-topaz-500/20 bg-topaz-500/10 px-3 py-1.5 font-medium text-topaz-400 text-xs transition-all hover:bg-topaz-500/20"
                                    >
                                        Edit
                                    </button>
                                    {s.active ? (
                                        <button
                                            onClick={() => handleDeactivate(s.id)}
                                            className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-400 text-xs transition-all hover:bg-amber-500/20"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(s.id)}
                                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 text-xs transition-all hover:bg-emerald-500/20"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(s.id)}
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

            {/* Create/Edit Modal */}
            {(showCreate || editingId) && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => {
                        setShowCreate(false);
                        setEditingId(null);
                        resetForm();
                    }}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <Title className="!text-white">{editingId ? "Edit Source" : "Add Source"}</Title>
                            <button
                                type="button"
                                onClick={() => setShowHelp(!showHelp)}
                                className="flex items-center gap-1 text-sm text-topaz-400 hover:text-topaz-300"
                            >
                                {showHelp ? "Hide" : "Show"} Tutorial
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d={showHelp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Tutorial Section */}
                        {showHelp && <SourcesTutorial />}

                        <form onSubmit={editingId ? handleUpdate : handleCreate} className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!editingId}
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none disabled:opacity-50"
                                    placeholder="stripe"
                                />
                                <p className="mt-1 text-gray-600 text-xs">
                                    Used in webhook URL: /webhooks/{form.name || "name"}
                                </p>
                            </div>

                            <div className="border-gray-800 border-t pt-4">
                                <p className="mb-3 text-gray-400 text-xs">Signature Verification (optional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Header Name</label>
                                        <input
                                            type="text"
                                            value={form.signatureHeader}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, signatureHeader: e.target.value }))
                                            }
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                            placeholder="stripe-signature"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Algorithm</label>
                                        <select
                                            value={form.signatureAlgorithm}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, signatureAlgorithm: e.target.value as any }))
                                            }
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-topaz-500 focus:outline-none"
                                        >
                                            <option value="">—</option>
                                            <option value="HMAC_SHA256">HMAC-SHA256</option>
                                            <option value="HMAC_SHA512">HMAC-SHA512</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="mb-1 block text-gray-400 text-sm">Secret</label>
                                    <input
                                        type="password"
                                        value={form.signatureSecret}
                                        onChange={(e) => setForm((f) => ({ ...f, signatureSecret: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder={editingId ? "Leave blank to keep existing" : "whsec_..."}
                                    />
                                </div>
                            </div>

                            <div className="border-gray-800 border-t pt-4">
                                <p className="mb-3 text-gray-400 text-xs">Deduplication (optional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Field Path</label>
                                        <input
                                            type="text"
                                            value={form.dedupField}
                                            onChange={(e) => setForm((f) => ({ ...f, dedupField: e.target.value }))}
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                            placeholder="id"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Window</label>
                                        <input
                                            type="text"
                                            value={form.dedupWindow}
                                            onChange={(e) => setForm((f) => ({ ...f, dedupWindow: e.target.value }))}
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                            placeholder="72h"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-gray-800 border-t pt-4">
                                <p className="mb-3 text-gray-400 text-xs">Rate Limiting (optional)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Max Requests</label>
                                        <input
                                            type="number"
                                            value={form.rateLimitMax}
                                            onChange={(e) => setForm((f) => ({ ...f, rateLimitMax: e.target.value }))}
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                            placeholder="10000"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-gray-400 text-sm">Window (ms)</label>
                                        <input
                                            type="number"
                                            value={form.rateLimitWindow}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, rateLimitWindow: e.target.value }))
                                            }
                                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                            placeholder="60000"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreate(false);
                                        setEditingId(null);
                                        resetForm();
                                    }}
                                    className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300 text-sm transition-colors hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                                >
                                    {editingId ? "Update" : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// Tutorial Component
function SourcesTutorial() {
    return (
        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
            <h3 className="mb-3 font-medium text-white">What are Sources?</h3>
            <p className="mb-4 text-gray-400 text-xs">
                Sources represent webhook providers that send events to Topaz. Each source defines how to receive,
                verify, and process webhooks from a specific provider like Stripe, GitHub, or your own system.
            </p>

            {/* Signature Verification */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">🔐 Signature Verification</h4>
                <p className="mb-2 text-gray-400 text-xs">
                    Verifies that webhooks actually come from the expected provider, preventing attackers from sending
                    fake events. Uses HMAC signatures shared between you and the provider.
                </p>

                <div className="mb-2 rounded bg-gray-900 p-3">
                    <p className="mb-2 text-gray-500 text-xs">How it works:</p>
                    <ol className="list-inside list-decimal space-y-1 text-gray-400 text-xs">
                        <li>Provider sends webhook with signature header</li>
                        <li>Topaz calculates expected signature using your secret</li>
                        <li>If signatures match → webhook is processed</li>
                        <li>If signatures don&apos;t match → webhook is rejected (401)</li>
                    </ol>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-emerald-300">stripe-signature</code>
                        <p className="mt-1 text-gray-500">For Stripe webhooks</p>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-emerald-300">x-hub-signature-256</code>
                        <p className="mt-1 text-gray-500">For GitHub webhooks</p>
                    </div>
                </div>

                <p className="mt-2 text-gray-500 text-xs">
                    Get the secret from your provider&apos;s webhook settings (e.g., Stripe Dashboard → Developers →
                    Webhooks)
                </p>
            </div>

            {/* Deduplication */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">🔄 Deduplication</h4>
                <p className="mb-2 text-gray-400 text-xs">
                    Prevents processing the same event multiple times. Providers often retry webhooks, and you
                    don&apos;t want to charge a customer twice for the same payment!
                </p>

                <div className="mb-2 rounded bg-gray-900 p-3">
                    <p className="mb-2 text-gray-500 text-xs">How it works:</p>
                    <ol className="list-inside list-decimal space-y-1 text-gray-400 text-xs">
                        <li>Extract unique ID from each webhook using the configured field path</li>
                        <li>Check if this ID was already processed within the time window</li>
                        <li>If yes → return 202 (accepted) but don&apos;t process again</li>
                        <li>If no → process and mark ID as seen for the window duration</li>
                    </ol>
                </div>

                <div className="space-y-2 text-xs">
                    <div className="rounded bg-gray-900 p-2">
                        <span className="text-purple-300">Field Path:</span>
                        <span className="ml-2 text-gray-400">JSON path to the unique event ID</span>
                        <div className="mt-1 font-mono text-gray-500">id, event.id, data.object.id</div>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <span className="text-purple-300">Window:</span>
                        <span className="ml-2 text-gray-400">How long to remember seen IDs</span>
                        <div className="mt-1 font-mono text-gray-500">72h, 24h, 7d (hours/days)</div>
                    </div>
                </div>

                <p className="mt-2 text-gray-500 text-xs">
                    Example: Stripe sends <code className="text-gray-400">evt_12345</code> in the{" "}
                    <code className="text-gray-400">id</code> field. Set Field Path to{" "}
                    <code className="text-gray-400">id</code> and Window to <code className="text-gray-400">72h</code>.
                </p>
            </div>

            {/* Rate Limiting */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">⚡ Rate Limiting</h4>
                <p className="mb-2 text-gray-400 text-xs">
                    Protects your system from being overwhelmed by too many webhooks. Useful when a provider sends
                    bursts of events or during incident recovery.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-gray-900 p-2">
                        <span className="text-purple-300">Max Requests:</span>
                        <p className="mt-1 text-gray-400">Maximum webhooks allowed</p>
                        <p className="mt-1 text-gray-500">Example: 10000</p>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <span className="text-purple-300">Window:</span>
                        <p className="mt-1 text-gray-400">Time period in milliseconds</p>
                        <p className="mt-1 text-gray-500">Example: 60000 (1 minute)</p>
                    </div>
                </div>

                <p className="mt-2 text-gray-500 text-xs">
                    Example: 10000 requests per 60000ms = max 10,000 webhooks per minute
                </p>
            </div>

            {/* Complete Example */}
            <div>
                <h4 className="mb-2 font-medium text-sm text-topaz-400">📋 Stripe Configuration Example</h4>
                <div className="rounded bg-gray-900 p-3 text-xs">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Name:</span>
                            <span className="font-mono text-gray-300">stripe</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Signature Header:</span>
                            <span className="font-mono text-gray-300">stripe-signature</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Algorithm:</span>
                            <span className="font-mono text-gray-300">HMAC-SHA256</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Secret:</span>
                            <span className="font-mono text-gray-300">whsec_xxxxxxxxxx...</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Dedup Field:</span>
                            <span className="font-mono text-gray-300">id</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Dedup Window:</span>
                            <span className="font-mono text-gray-300">72h</span>
                        </div>
                    </div>
                </div>
                <p className="mt-2 text-gray-500 text-xs">
                    Webhook URL: <code className="text-gray-400">https://your-domain.com/webhooks/stripe</code>
                </p>
            </div>
        </div>
    );
}
