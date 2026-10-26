import { readings } from "@/db/schema";
import type { getDb } from "@/db";
import { DISPLAY_WINDOW_MS, bucketStartMs, smoothReadingWindows } from "@/lib/cabinet/smoothing";
import { and, asc, eq, inArray, lt } from "drizzle-orm";

type Db = Awaited<ReturnType<typeof getDb>>;

/** Raw 15-second samples stay this long. Older windows become one smoothed point. */
export const RAW_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export async function rollupOldReadings(db: Db, now = new Date()) {
  const cutoffMs = now.getTime() - RAW_RETENTION_MS;
  const cutoff = new Date(cutoffMs);
  const sensorRows = await db
    .selectDistinct({ sensorId: readings.sensorId })
    .from(readings)
    .where(lt(readings.ts, cutoff));

  let windowsRolled = 0;
  let rowsRemoved = 0;

  for (const { sensorId } of sensorRows) {
    const rows = await db
      .select()
      .from(readings)
      .where(and(eq(readings.sensorId, sensorId), lt(readings.ts, cutoff)))
      .orderBy(asc(readings.ts));

    const buckets = new Map<number, typeof rows>();
    for (const row of rows) {
      const start = bucketStartMs(row.ts.getTime());
      if (start + DISPLAY_WINDOW_MS > cutoffMs) continue;
      const list = buckets.get(start);
      if (list) list.push(row);
      else buckets.set(start, [row]);
    }

    const replacements: { ids: string[]; organizationId: string; window: ReturnType<typeof smoothReadingWindows>[number] }[] = [];
    for (const bucket of buckets.values()) {
      if (bucket.length === 1 && bucket[0].ts.getTime() === bucketStartMs(bucket[0].ts.getTime())) continue;
      const [window] = smoothReadingWindows(
        bucket.map((row) => ({ ts: row.ts, temperature: row.temperature, humidity: row.humidity })),
      );
      if (!window) continue;
      replacements.push({
        ids: bucket.map((row) => row.id),
        organizationId: bucket[0].organizationId,
        window,
      });
    }
    if (replacements.length === 0) continue;

    await db.transaction(async (tx) => {
      for (const replacement of replacements) {
        await tx.delete(readings).where(inArray(readings.id, replacement.ids));
        await tx.insert(readings).values({
          sensorId,
          organizationId: replacement.organizationId,
          ts: replacement.window.ts,
          temperature: replacement.window.temperature,
          humidity: replacement.window.humidity,
          vpd: replacement.window.vpd,
          dewPoint: replacement.window.dewPoint,
        });
      }
    });
    windowsRolled += replacements.length;
    rowsRemoved += replacements.reduce((sum, replacement) => sum + replacement.ids.length, 0);
  }

  return {
    cutoff: cutoff.toISOString(),
    sensors: sensorRows.length,
    windowsRolled,
    rowsRemoved,
  };
}
