import { Card, Title } from "@tremor/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";

import { activateSchema, createSchema, deactivateSchema, deleteSchemaPermenant, fetchSchemas } from "@/api/client";

interface SchemaDefinition {
    id: string;
    source: string;
    eventType: string;
    version: number;
    schema: object;
    rejectOnFail: boolean;
    active: boolean;
    createdAt: string;
}

export function Schemas() {
    const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        source: "",
        eventType: "",
        jsonSchema: "{}",
        rejectOnFail: false,
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchSchemas();
            setSchemas(Array.isArray(data) ? data : (data.data ?? data.schemas ?? []));
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
            await createSchema({
                source: form.source,
                eventType: form.eventType,
                jsonSchema: JSON.parse(form.jsonSchema),
                rejectOnFail: form.rejectOnFail,
            });
            setShowCreate(false);
            setForm({ source: "", eventType: "", jsonSchema: "{}", rejectOnFail: false });
            load();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Invalid JSON Schema");
        }
    };

    const handleActivate = async (id: string) => {
        try {
            await activateSchema(id);
        } catch {
            // silent
        }
        await load();
    };

    const handleDeactivate = async (id: string) => {
        try {
            await deactivateSchema(id);
        } catch {
            // 204 No Content may cause axios to throw
        }
        await load();
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm("Permanently delete this schema? This cannot be undone.")) return;
        try {
            await deleteSchemaPermenant(id);
        } catch {
            // 204 No Content may cause axios to throw
        }
        await load();
    };

    return (
        <>
            <PageHeader
                title="Schemas"
                description="JSON Schema definitions for payload validation"
                action={
                    <button
                        onClick={() => setShowCreate(true)}
                        className="rounded-lg bg-topaz-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-topaz-500"
                    >
                        Add Schema
                    </button>
                }
            />

            <div className="grid gap-4">
                {loading && schemas.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-topaz-400 border-t-transparent" />
                        </div>
                    </Card>
                ) : schemas.length === 0 ? (
                    <Card className="!bg-gray-900 !border-gray-800 !ring-0">
                        <div className="flex h-32 flex-col items-center justify-center gap-2">
                            <p className="text-gray-400">No schemas configured</p>
                            <p className="text-gray-600 text-sm">Add one to enable payload validation</p>
                        </div>
                    </Card>
                ) : (
                    schemas.map((schema) => (
                        <Card key={schema.id} className="!bg-gray-900 !border-gray-800 !ring-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge color="topaz" size="xs">
                                            {schema.source}
                                        </Badge>
                                        <span className="truncate font-mono text-sm text-white">
                                            {schema.eventType}
                                        </span>
                                        <Badge color={schema.active ? "emerald" : "gray"} size="xs">
                                            v{schema.version}
                                        </Badge>
                                        {schema.rejectOnFail && (
                                            <Badge color="red" size="xs">
                                                Strict
                                            </Badge>
                                        )}
                                        {!schema.active && (
                                            <Badge color="gray" size="xs">
                                                Inactive
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-gray-500 text-xs">
                                        Created {new Date(schema.createdAt).toLocaleString()}
                                    </p>

                                    {expandedId === schema.id && (
                                        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-gray-300 text-sm">
                                            {JSON.stringify(schema.schema, null, 2)}
                                        </pre>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                        onClick={() => setExpandedId(expandedId === schema.id ? null : schema.id)}
                                        className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 font-medium text-gray-300 text-xs transition-all hover:bg-gray-700 hover:text-white"
                                    >
                                        {expandedId === schema.id ? "Hide" : "View"}
                                    </button>
                                    {schema.active ? (
                                        <button
                                            onClick={() => handleDeactivate(schema.id)}
                                            className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-medium text-amber-400 text-xs transition-all hover:bg-amber-500/20"
                                        >
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(schema.id)}
                                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-400 text-xs transition-all hover:bg-emerald-500/20"
                                        >
                                            Activate
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handlePermanentDelete(schema.id)}
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
                        <Title className="!text-white mb-4">Add Schema</Title>
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
                                        required
                                        value={form.eventType}
                                        onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                        placeholder="payment_intent.succeeded"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-gray-400 text-sm">JSON Schema</label>
                                <textarea
                                    required
                                    rows={8}
                                    value={form.jsonSchema}
                                    onChange={(e) => setForm((f) => ({ ...f, jsonSchema: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white placeholder-gray-600 focus:border-topaz-500 focus:outline-none"
                                    placeholder='{"type": "object", "properties": {...}}'
                                />
                            </div>
                            <label className="flex items-center gap-2 text-gray-400 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.rejectOnFail}
                                    onChange={(e) => setForm((f) => ({ ...f, rejectOnFail: e.target.checked }))}
                                    className="rounded border-gray-700 bg-gray-800"
                                />
                                Reject invalid payloads (strict mode)
                            </label>
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
