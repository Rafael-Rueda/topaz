import { nanoid } from "nanoid";

export class BatchId {
    private constructor(private readonly value: string) {}

    static generate(): BatchId {
        return new BatchId(`batch_${nanoid(12)}`);
    }

    static fromString(value: string): BatchId {
        if (!value.startsWith("batch_")) {
            throw new Error("Invalid BatchId format");
        }
        return new BatchId(value);
    }

    toString(): string {
        return this.value;
    }

    equals(other: BatchId): boolean {
        return this.value === other.value;
    }
}
