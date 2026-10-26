import { readings } from "@/db/schema";
import { smoothReadingWindows } from "@/lib/cabinet/smoothing";
import { rollupOldReadings } from "@/lib/readings-rollup";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertReading, seedGateway } from "./helpers/seed";

describe("rollupOldReadings", () => {
  it("replaces a finished old window with its smoothed point and leaves recent samples", async () => {
    const { db, org, sensor } = await seedGateway();
    const now = new Date("2026-10-26T12:00:00.000Z");
    const oldStart = new Date("2026-10-01T10:00:00.000Z");
    const samples = [
      { ts: oldStart, temperature: 10, humidity: 50 },
      { ts: new Date(oldStart.getTime() + 15_000), temperature: 11, humidity: 55 },
      { ts: new Date(oldStart.getTime() + 30_000), temperature: 13, humidity: 60 },
    ];
    for (const sample of samples) {
      await insertReading(db, { sensorId: sensor.id, organizationId: org.id, ...sample });
    }
    const recentTs = new Date("2026-10-25T10:00:15.000Z");
    await insertReading(db, {
      sensorId: sensor.id,
      organizationId: org.id,
      ts: recentTs,
      temperature: 22,
      humidity: 70,
    });

    const first = await rollupOldReadings(db, now);
    expect(first.windowsRolled).toBe(1);
    expect(first.rowsRemoved).toBe(3);

    const stored = await db.select().from(readings).where(eq(readings.sensorId, sensor.id));
    expect(stored).toHaveLength(2);
    const old = stored.find((row) => row.ts.getTime() === oldStart.getTime());
    const [expected] = smoothReadingWindows(samples);
    expect(old?.temperature).toBe(expected.temperature);
    expect(old?.humidity).toBe(expected.humidity);
    expect(old?.vpd).toBe(expected.vpd);
    expect(stored.some((row) => row.ts.getTime() === recentTs.getTime() && row.temperature === 22)).toBe(true);

    const second = await rollupOldReadings(db, now);
    expect(second.windowsRolled).toBe(0);
    expect(await db.select().from(readings).where(eq(readings.sensorId, sensor.id))).toHaveLength(2);
  });
});
