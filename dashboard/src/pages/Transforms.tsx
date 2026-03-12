import { Card, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import {
    activateTransform,
    createTransform,
    deactivateTransform,
    deleteTransformPermenant,
    fetchTransforms,
    testTransform,
    updateTransform,
} from "@/api/client";

interface Transform {
    id: string;
    source: string;
    eventType: string;
    mapping: Record<string, string>;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export function Transforms() {
    const [transforms, setTransforms] = useState<Transform[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showTest, setShowTest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const [form, setForm] = useState({
        source: "",
        eventType: "",
        mapping: "",
    });

    const [testForm, setTestForm] = useState({
        source: "",
        eventType: "",
        payload: "",
    });
    const [testResult, setTestResult] = useState<{
        original: unknown;
        transformed: unknown;
        hasTransform: boolean;
    } | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchTransforms();
            setTransforms(Array.isArray(data) ? data : (data.data ?? []));
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
            const mapping = parseMapping(form.mapping);
            await createTransform({
                source: form.source,
                eventType: form.eventType,
                mapping,
            });
            setShowCreate(false);
            setForm({ source: "", eventType: "", mapping: "" });
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create transform");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        try {
            const mapping = parseMapping(form.mapping);
            await updateTransform(editingId, { mapping });
            setEditingId(null);
            setForm({ source: "", eventType: "", mapping: "" });
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to update transform");
        }
    };

    const handleTest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = JSON.parse(testForm.payload);
            const result = await testTransform({
                source: testForm.source,
                eventType: testForm.eventType,
                payload,
            });
            setTestResult(result);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to test transform");
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            await deactivateTransform(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleActivate = async (id: string) => {
        try {
            await activateTransform(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Permanently delete this transform? This cannot be undone.")) return;
        try {
            await deleteTransformPermenant(id);
        } catch {
            // silent
        }
        await load();
    };

    const startEdit = (t: Transform) => {
        setEditingId(t.id);
        setForm({
            source: t.source,
            eventType: t.eventType,
            mapping: JSON.stringify(t.mapping, null, 2),
        });
    };

    const formatMapping = (mapping: Record<string, string>) => {
        return Object.entries(mapping)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
    };

    return (
        <>
            <PageHeader
                title="Transforms"
                description="Transform webhook payloads before delivery"
                action={
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowTest(true)}
                            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700"
                        >
                            Test Transform
                        </button>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                        >
                            Add Transform
                        </button>
                    </div>
                }
            />

            <div className="grid gap-4">
                {loading && transforms.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                        </div>
                    </Card>
                ) : transforms.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <p className="text-gray-400">No transforms configured</p>
                            <p className="text-gray-600 text-sm">Add one to transform webhook payloads</p>
                        </div>
                    </Card>
                ) : (
                    transforms.map((t) => (
                        <Card key={t.id} className="!bg-gray-900 !border-gray-800 !ring-0 max-w-full overflow-hidden">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge color="topaz" size="xs">
                                            {t.source}
                                        </Badge>
                                        <span className="font-mono text-sm text-white">{t.eventType}</span>
                                        <Badge color={t.active ? "emerald" : "gray"} size="xs">
                                            {t.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <div className="mt-2">
                                        <p className="mb-1 text-gray-500 text-xs">Mapping:</p>
                                        <div className="max-w-full overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(55 65 81) transparent' }}>
                                            <p className="whitespace-nowrap font-mono text-gray-300 text-sm">
                                                {formatMapping(t.mapping)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                    <button
                                        onClick={() => startEdit(t)}
                                        className="rounded-md border border-topaz-500/20 bg-topaz-500/10 px-3 py-1.5 font-medium text-topaz-400 text-xs transition-all hover:bg-topaz-500/20"
                                    >
                                        Edit
                                    </button>
                                    {t.active ? (
                                        <button
                                            onClick={() => handleDeactivate(t.id)}
                                            className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-400 text-xs transition-all hover:bg-amber-500/20"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(t.id)}
                                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 text-xs transition-all hover:bg-emerald-500/20"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(t.id)}
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
                        setForm({ source: "", eventType: "", mapping: "" });
                        setShowHelp(false);
                    }}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <Title className="!text-white">{editingId ? "Edit Transform" : "Add Transform"}</Title>
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
                        {showHelp && <TransformTutorial />}

                        <form onSubmit={editingId ? handleUpdate : handleCreate} className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Source</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!editingId}
                                    value={form.source}
                                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none disabled:opacity-50"
                                    placeholder="stripe"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Event Type</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!editingId}
                                    value={form.eventType}
                                    onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none disabled:opacity-50"
                                    placeholder="payment_intent.succeeded"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Mapping (JSON)</label>
                                <textarea
                                    required
                                    rows={8}
                                    value={form.mapping}
                                    onChange={(e) => setForm((f) => ({ ...f, mapping: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder={`{\n  "order_id": "data.object.metadata.order_id",\n  "amount": "data.object.amount | divide(100)"\n}`}
                                />
                                <p className="mt-1 text-gray-600 text-xs">
                                    Use JSON format. Values can include path expressions and operations like |
                                    divide(100)
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreate(false);
                                        setEditingId(null);
                                        setForm({ source: "", eventType: "", mapping: "" });
                                        setShowHelp(false);
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

            {/* Test Modal */}
            {showTest && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => {
                        setShowTest(false);
                        setTestResult(null);
                    }}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Title className="!text-white mb-4">Test Transform</Title>
                        <form onSubmit={handleTest} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Source</label>
                                    <input
                                        type="text"
                                        required
                                        value={testForm.source}
                                        onChange={(e) => setTestForm((f) => ({ ...f, source: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="stripe"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-gray-400 text-sm">Event Type</label>
                                    <input
                                        type="text"
                                        required
                                        value={testForm.eventType}
                                        onChange={(e) => setTestForm((f) => ({ ...f, eventType: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="payment_intent.succeeded"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">Payload (JSON)</label>
                                <textarea
                                    required
                                    rows={6}
                                    value={testForm.payload}
                                    onChange={(e) => setTestForm((f) => ({ ...f, payload: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder={`{\n  "data": {\n    "object": {\n      "id": "pi_123",\n      "amount": 49990\n    }\n  }\n}`}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowTest(false);
                                        setTestResult(null);
                                    }}
                                    className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300 text-sm transition-colors hover:bg-gray-700"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                                >
                                    Test
                                </button>
                            </div>
                        </form>

                        {testResult && (
                            <div className="mt-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="mb-1 text-gray-500 text-xs">Original Payload</p>
                                        <pre className="max-h-48 overflow-auto rounded-lg bg-gray-950 p-3 text-gray-300 text-xs">
                                            {JSON.stringify(testResult.original, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-gray-500 text-xs">Transformed Payload</p>
                                        <pre
                                            className={`max-h-48 overflow-auto rounded-lg p-3 text-xs ${testResult.hasTransform ? "bg-emerald-950/30 text-emerald-300" : "bg-gray-950 text-gray-300"}`}
                                        >
                                            {JSON.stringify(testResult.transformed, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                                {testResult.hasTransform ? (
                                    <p className="text-center text-emerald-400 text-xs">
                                        Transform applied successfully
                                    </p>
                                ) : (
                                    <p className="text-center text-amber-400 text-xs">
                                        No transform found for this source/event type
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

// Tutorial Component
function TransformTutorial() {
    return (
        <div className="mb-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
            <h3 className="mb-3 font-medium text-white">Transform Syntax Guide</h3>

            {/* Basic Syntax */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Basic Syntax</h4>
                <p className="mb-2 text-gray-400 text-xs">
                    Mappings use JSON format where keys are output field names and values are expressions:
                </p>
                <pre className="rounded bg-gray-900 p-2 font-mono text-gray-300 text-xs">
                    {`{
  "outputField": "path.to.value | operation",
  "simpleField": "data.object.id"
}`}
                </pre>
            </div>

            {/* Special Tokens */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Special Tokens (@)</h4>
                <p className="mb-2 text-gray-400 text-xs">Use @ tokens to access metadata about the event:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-topaz-300">@timestamp</code>
                        <p className="mt-1 text-gray-500">ISO timestamp when event was received</p>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-topaz-300">@id</code>
                        <p className="mt-1 text-gray-500">Unique event ID generated by Topaz</p>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-topaz-300">@source</code>
                        <p className="mt-1 text-gray-500">Source name (e.g., &quot;stripe&quot;)</p>
                    </div>
                    <div className="rounded bg-gray-900 p-2">
                        <code className="text-topaz-300">@event_type</code>
                        <p className="mt-1 text-gray-500">Event type (e.g., &quot;payment_intent.succeeded&quot;)</p>
                    </div>
                    <div className="col-span-2 rounded bg-gray-900 p-2">
                        <code className="text-topaz-300">@raw</code>
                        <p className="mt-1 text-gray-500">The entire original payload (useful for passthrough)</p>
                    </div>
                </div>
            </div>

            {/* Operations */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Operations (|)</h4>
                <p className="mb-2 text-gray-400 text-xs">Chain operations with | to transform values:</p>
                <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| divide(n)</code>
                        <span className="text-gray-400">
                            Divide by n. <code className="text-gray-500">&quot;amount | divide(100)&quot;</code> →
                            converts cents to dollars
                        </span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| multiply(n)</code>
                        <span className="text-gray-400">
                            Multiply by n. <code className="text-gray-500">&quot;quantity | multiply(2)&quot;</code>
                        </span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| uppercase</code>
                        <span className="text-gray-400">
                            Convert to uppercase.{" "}
                            <code className="text-gray-500">&quot;currency | uppercase&quot;</code> → &quot;BRL&quot;
                        </span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| lowercase</code>
                        <span className="text-gray-400">
                            Convert to lowercase. <code className="text-gray-500">&quot;email | lowercase&quot;</code>
                        </span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| trim</code>
                        <span className="text-gray-400">Remove whitespace from start and end</span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| default(value)</code>
                        <span className="text-gray-400">
                            Use default if value is null/undefined.{" "}
                            <code className="text-gray-500">&quot;email | default(unknown)&quot;</code>
                        </span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| toString</code>
                        <span className="text-gray-400">Convert to string</span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| toNumber</code>
                        <span className="text-gray-400">Convert to number</span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| toBoolean</code>
                        <span className="text-gray-400">Convert to boolean</span>
                    </div>
                    <div className="flex items-start gap-3 rounded bg-gray-900 p-2">
                        <code className="shrink-0 text-purple-300">| slice(start,end)</code>
                        <span className="text-gray-400">
                            Extract substring. <code className="text-gray-500">&quot;id | slice(0,8)&quot;</code> →
                            first 8 chars
                        </span>
                    </div>
                </div>
            </div>

            {/* Chaining */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Chaining Operations</h4>
                <p className="mb-2 text-gray-400 text-xs">You can chain multiple operations:</p>
                <pre className="rounded bg-gray-900 p-2 font-mono text-gray-300 text-xs">
                    {`{
  "amount": "data.object.amount | divide(100) | toString",
  "currency": "data.object.currency | uppercase | default(USD)",
  "short_id": "data.object.id | slice(0,12) | uppercase"
}`}
                </pre>
            </div>

            {/* Dot Notation */}
            <div className="mb-4">
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Dot Path Notation</h4>
                <p className="mb-2 text-gray-400 text-xs">Access nested fields using dots:</p>
                <pre className="rounded bg-gray-900 p-2 font-mono text-gray-300 text-xs">
                    {`{
  "order_id": "data.object.metadata.order_id",
  "customer_email": "data.object.customer.email",
  "first_item": "data.object.items.0.name"
}`}
                </pre>
            </div>

            {/* Full Example */}
            <div>
                <h4 className="mb-2 font-medium text-sm text-topaz-400">Complete Example</h4>
                <p className="mb-2 text-gray-400 text-xs">Transform a Stripe payment_intent.succeeded event:</p>
                <pre className="rounded bg-gray-900 p-2 font-mono text-gray-300 text-xs">
                    {`{
  "order_id": "data.object.metadata.order_id",
  "amount": "data.object.amount | divide(100)",
  "currency": "data.object.currency | uppercase",
  "status": "data.object.status",
  "customer_id": "data.object.customer",
  "payment_method": "data.object.payment_method_types.0",
  "event_type": "@event_type",
  "processed_at": "@timestamp",
  "topaz_id": "@id"
}`}
                </pre>
                <p className="mt-2 text-gray-500 text-xs">
                    This transforms Stripe&apos;s cents-based amount to dollars and adds metadata fields.
                </p>
            </div>
        </div>
    );
}

function parseMapping(input: string): Record<string, string> {
    try {
        const parsed = JSON.parse(input);
        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Mapping must be an object");
        }
        return parsed;
    } catch (err) {
        throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
}
