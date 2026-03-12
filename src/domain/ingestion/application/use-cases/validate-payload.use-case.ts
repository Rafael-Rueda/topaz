import type { ErrorObject } from "ajv";
import Ajv from "ajv";
import addFormats from "ajv-formats";

import type { ISchemaRepository } from "../interfaces/schema-repository.interface.js";

export interface ValidatePayloadInput {
    source: string;
    eventType: string | null;
    payload: unknown;
}

export interface ValidatePayloadOutput {
    status: "VALID" | "INVALID" | "NO_SCHEMA" | "SKIPPED";
    errors: object[] | null;
    rejectOnFail: boolean;
}

export interface ValidatePayloadDeps {
    schemaRepository: ISchemaRepository;
}

// CJS/ESM interop: Ajv and ajv-formats need runtime unwrapping under NodeNext
type AjvClass = InstanceType<typeof Ajv.default>;
const AjvConstructor = (
    Ajv as unknown as { default: new (opts: ConstructorParameters<typeof Ajv.default>[0]) => AjvClass }
).default;
const ajv = new AjvConstructor({ allErrors: true, strict: false });
(addFormats as unknown as (ajv: AjvClass) => void)(ajv);

export class ValidatePayloadUseCase {
    constructor(private readonly deps: ValidatePayloadDeps) {}

    async execute(input: ValidatePayloadInput): Promise<ValidatePayloadOutput> {
        if (!input.eventType) {
            return { status: "SKIPPED", errors: null, rejectOnFail: false };
        }

        const schemaDef = await this.deps.schemaRepository.findActive(input.source, input.eventType);

        if (!schemaDef) {
            return { status: "NO_SCHEMA", errors: null, rejectOnFail: false };
        }

        const validate = ajv.compile(schemaDef.schema);
        const valid = validate(input.payload);

        if (valid) {
            return { status: "VALID", errors: null, rejectOnFail: schemaDef.rejectOnFail };
        }

        const errors = (validate.errors ?? []).map((e: ErrorObject) => ({
            path: e.instancePath || "/",
            message: e.message ?? "unknown error",
            keyword: e.keyword,
            params: e.params,
        }));

        return {
            status: "INVALID",
            errors,
            rejectOnFail: schemaDef.rejectOnFail,
        };
    }
}
