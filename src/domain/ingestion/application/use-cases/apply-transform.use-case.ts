import type { Logger } from "../../../../infra/config/logger.js";
import type { ITransformRepository } from "../interfaces/transform-repository.interface.js";

export interface ApplyTransformDeps {
    transformRepository: ITransformRepository;
    logger: Logger;
}

export interface TransformContext {
    id: string;
    source: string;
    eventType: string;
    timestamp: Date;
}

export class ApplyTransformUseCase {
    constructor(private readonly deps: ApplyTransformDeps) {}

    /**
     * Find the active transform for source+eventType and apply it to the payload.
     * Returns the transformed payload, or the original if no transform is configured.
     */
    async execute(context: TransformContext, payload: unknown): Promise<unknown> {
        const transform = await this.deps.transformRepository.findActive(context.source, context.eventType);

        if (!transform) return payload;

        try {
            return applyMapping(transform.mapping, payload, context);
        } catch (err) {
            this.deps.logger.error(
                {
                    error: (err as Error).message,
                    transformId: transform.id,
                    source: context.source,
                    eventType: context.eventType,
                },
                "Transform failed — delivering raw payload",
            );
            return payload;
        }
    }
}

// ─── Transform Engine (pure, no side-effects) ───────────────────────

/**
 * Apply a declarative mapping to a payload.
 *
 * Mapping format:
 *   "outputField": "path.to.field"                  — extract value
 *   "outputField": "path.to.field | operation"      — extract + transform
 *   "outputField": "path.to.field | op1 | op2"      — chained operations
 *   "outputField": "@timestamp"                      — event timestamp ISO
 *   "outputField": "@raw"                            — entire original payload
 *   "outputField": "@source"                         — event source
 *   "outputField": "@event_type"                     — event type
 *   "outputField": "@id"                             — event id
 *
 * Supported operations:
 *   divide(n)      — divide number by n
 *   multiply(n)    — multiply number by n
 *   uppercase      — string to upper case
 *   lowercase      — string to lower case
 *   trim           — trim whitespace
 *   default(value) — fallback if value is null/undefined
 *   toString       — coerce to string
 *   toNumber       — coerce to number
 *   toBoolean      — coerce to boolean
 *   slice(start,end) — substring/array slice
 */
export function applyMapping(
    mapping: Record<string, string>,
    payload: unknown,
    context: TransformContext,
): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [outputKey, expression] of Object.entries(mapping)) {
        result[outputKey] = evaluateExpression(expression, payload, context);
    }

    return result;
}

function evaluateExpression(expression: string, payload: unknown, context: TransformContext): unknown {
    const parts = expression.split("|").map((p) => p.trim());
    const sourcePath = parts[0];
    const operations = parts.slice(1);

    let value = resolveValue(sourcePath, payload, context);

    for (const op of operations) {
        value = applyOperation(op, value);
    }

    return value;
}

function resolveValue(path: string, payload: unknown, context: TransformContext): unknown {
    // Special tokens
    switch (path) {
        case "@timestamp":
            return context.timestamp.toISOString();
        case "@raw":
            return payload;
        case "@source":
            return context.source;
        case "@event_type":
            return context.eventType;
        case "@id":
            return context.id;
    }

    // Literal string (quoted)
    if ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'"))) {
        return path.slice(1, -1);
    }

    // Literal number
    if (/^-?\d+(\.\d+)?$/.test(path)) {
        return Number(path);
    }

    // Dot-path extraction from payload
    return getNestedValue(payload, path);
}

function getNestedValue(obj: unknown, path: string): unknown {
    const segments = path.split(".");
    let current: unknown = obj;

    for (const segment of segments) {
        if (current == null || typeof current !== "object") return undefined;

        // Support array index: "items.0.name"
        const record = current as Record<string, unknown>;
        current = record[segment];
    }

    return current;
}

const OP_REGEX = /^(\w+)(?:\((.+)\))?$/;

function applyOperation(op: string, value: unknown): unknown {
    const match = op.match(OP_REGEX);
    if (!match) return value;

    const name = match[1];
    const arg = match[2];

    switch (name) {
        case "divide": {
            const divisor = Number(arg);
            return typeof value === "number" && divisor !== 0 ? value / divisor : value;
        }
        case "multiply": {
            const factor = Number(arg);
            return typeof value === "number" ? value * factor : value;
        }
        case "uppercase":
            return typeof value === "string" ? value.toUpperCase() : value;
        case "lowercase":
            return typeof value === "string" ? value.toLowerCase() : value;
        case "trim":
            return typeof value === "string" ? value.trim() : value;
        case "default":
            return value == null ? parseArgValue(arg ?? "") : value;
        case "toString":
            return value == null ? "" : String(value);
        case "toNumber":
            return typeof value === "string" ? Number(value) : value;
        case "toBoolean":
            return Boolean(value);
        case "slice": {
            const args = (arg ?? "").split(",").map((a) => Number(a.trim()));
            if (typeof value === "string" || Array.isArray(value)) {
                return value.slice(args[0], args[1]);
            }
            return value;
        }
        default:
            return value;
    }
}

function parseArgValue(arg: string): unknown {
    // Quoted string
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
    }
    if (arg === "true") return true;
    if (arg === "false") return false;
    if (arg === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
    return arg;
}
