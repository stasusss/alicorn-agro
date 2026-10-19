import { readings } from "@/db/schema";
import type { getDb } from "@/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export class IngestChunkError extends Error {
  readonly chunkIndex: number;
  override readonly cause: unknown;

  constructor(chunkIndex: number, cause: unknown) {
    super(`ingest chunk ${chunkIndex} failed`);
    this.name = "IngestChunkError";
    this.chunkIndex = chunkIndex;
    this.cause = cause;
  }
}

export async function insertReadingsInTransaction(
  db: Db,
  rows: (typeof readings.$inferInsert)[],
  chunkSize = 200,
) {
  let inserted = 0;
  await db.transaction(async (tx) => {
    for (let index = 0; index < rows.length; index += chunkSize) {
      const chunkIndex = index / chunkSize;
      const chunk = rows.slice(index, index + chunkSize);
      try {
        const result = await tx
          .insert(readings)
          .values(chunk)
          .onConflictDoNothing({ target: [readings.sensorId, readings.ts] })
          .returning({ id: readings.id });
        inserted += result.length;
      } catch (err) {
        throw new IngestChunkError(chunkIndex, err);
      }
    }
  });
  return inserted;
}
