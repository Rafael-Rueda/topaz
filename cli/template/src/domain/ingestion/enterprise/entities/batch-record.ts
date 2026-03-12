import { z } from "zod";

export const BatchRecordSchema = z.object({
    batchId: z.string(),
    chunkIndex: z.number(),
    rows: z.array(z.record(z.unknown())),
    totalRowsInChunk: z.number(),
    createdAt: z.date(),
});

export type BatchRecordProps = z.infer<typeof BatchRecordSchema>;

export class BatchRecord {
    private constructor(private readonly props: BatchRecordProps) {}

    static create(props: BatchRecordProps): BatchRecord {
        return new BatchRecord(props);
    }

    get batchId(): string {
        return this.props.batchId;
    }

    get chunkIndex(): number {
        return this.props.chunkIndex;
    }

    get rows(): Record<string, unknown>[] {
        return this.props.rows;
    }

    get totalRowsInChunk(): number {
        return this.props.totalRowsInChunk;
    }

    get createdAt(): Date {
        return this.props.createdAt;
    }

    toJSON(): BatchRecordProps {
        return { ...this.props };
    }
}
