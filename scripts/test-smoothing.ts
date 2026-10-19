/**
 * Checks the 5-minute smoothing formula and that cabinet queries use it.
 * Uses a throwaway PGlite database, not DATABASE_URL from the environment.
 *
 *   npm run test:smoothing
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "alicorn-smooth-"));
process.env.DATABASE_URL = `pglite:${join(dir, "db")}`;

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  console.log("ok", message);
}

function near(actual: number, expected: number) {
  return Math.abs(actual - expected) < 1e-9;
}

async function main() {
  const { smoothedWindowAverage, smoothTimeSeries, bucketStartMs, DISPLAY_WINDOW_MS } =
    await import("../src/lib/cabinet/smoothing");

  assert(smoothedWindowAverage([]) === null, "empty window");
  assert(smoothedWindowAverage([7]) === 7, "single sample");
  assert(smoothedWindowAverage([22.5, 22.5, 22.5, 22.5]) === 22.5, "flat series stays flat");

  // t = [10, 11, 12, 9, 13], tn = 13
  // 10 + (9+1.3) + (9.9+1.3) + (10.8+1.3) + (8.1+1.3) = 53; 53/5 = 10.6
  assert(
    near(smoothedWindowAverage([10, 11, 12, 9, 13]) ?? NaN, 10.6),
    "five samples divide by 5",
  );

  // t = [18, 19, 21, 20], tn = 20 → 76.2 / 4 = 19.05 (plain mean would be 19.5)
  assert(near(smoothedWindowAverage([18, 19, 21, 20]) ?? NaN, 19.05), "four-sample formula");

  const full = Array.from({ length: 20 }, (_, i) => i + 1);
  assert(near(smoothedWindowAverage(full) ?? NaN, 10.5), "full 20-sample window");

  const windowStart = Date.parse("2026-10-19T12:00:00.000Z");
  assert(bucketStartMs(windowStart + 4 * 60_000) === windowStart, "bucket floors inside the window");
  assert(
    bucketStartMs(windowStart + DISPLAY_WINDOW_MS) === windowStart + DISPLAY_WINDOW_MS,
    "boundary opens the next window",
  );

  const series = smoothTimeSeries([
    { ts: new Date(windowStart + 30_000), value: 21 },
    { ts: new Date(windowStart), value: 18 },
    { ts: new Date(windowStart + DISPLAY_WINDOW_MS), value: 30 },
    { ts: new Date(windowStart + 45_000), value: 20 },
    { ts: new Date(windowStart + 15_000), value: 19 },
  ]);
  assert(series.length === 2, "two buckets");
  assert(series[0].count === 4 && near(series[0].value, 19.05), "first bucket keeps time order");
  assert(series[1].count === 1 && series[1].value === 30, "boundary sample is its own bucket");

  const { getDb } = await import("../src/db");
  const { gateways, organizations, readings, sensors } = await import("../src/db/schema");
  const { getChartSeries, getSmoothedLatestReading } = await import("../src/lib/cabinet/queries");

  const db = await getDb();
  const [org] = await db
    .insert(organizations)
    .values({ name: "Smoothing test", latitude: 50.45, longitude: 30.52 })
    .returning();
  const [gateway] = await db
    .insert(gateways)
    .values({ organizationId: org.id, name: "gw", apiKeyHash: "test" })
    .returning();
  const [sensorA] = await db
    .insert(sensors)
    .values({
      organizationId: org.id,
      gatewayId: gateway.id,
      externalId: "s-a",
      name: "A",
    })
    .returning();
  const [sensorB] = await db
    .insert(sensors)
    .values({
      organizationId: org.id,
      gatewayId: gateway.id,
      externalId: "s-b",
      name: "B",
    })
    .returning();

  const samples = [
    { offset: 30_000, temperature: 21, humidity: 60, vpd: 1, dewPoint: 8 },
    { offset: 0, temperature: 18, humidity: 40, vpd: 1, dewPoint: 8 },
    { offset: 45_000, temperature: 20, humidity: 70, vpd: 2, dewPoint: 8 },
    { offset: 15_000, temperature: 19, humidity: 50, vpd: 1, dewPoint: 8 },
  ];
  await db.insert(readings).values(
    samples.map((sample) => ({
      sensorId: sensorA.id,
      organizationId: org.id,
      ts: new Date(windowStart + sample.offset),
      temperature: sample.temperature,
      humidity: sample.humidity,
      vpd: sample.vpd,
      dewPoint: sample.dewPoint,
    })),
  );
  await db.insert(readings).values({
    sensorId: sensorB.id,
    organizationId: org.id,
    ts: new Date(windowStart),
    temperature: 7,
    humidity: 55,
    vpd: 0.8,
    dewPoint: 6,
  });

  const latestA = await getSmoothedLatestReading(sensorA.id);
  assert(latestA !== null, "sensor A has a window");
  assert(near(latestA.temperature, 19.05), "latest temperature is the 5-minute smooth");
  assert(near(latestA.humidity, 49), "humidity is smoothed on its own");
  assert(near(latestA.vpd, 1.075), "vpd is smoothed on its own");
  assert(latestA.dewPoint === 8, "flat dew point");
  assert(latestA.ts.getTime() === windowStart + 45_000, "timestamp stays the last raw sample");

  const latestB = await getSmoothedLatestReading(sensorB.id);
  assert(latestB?.temperature === 7, "a lone sample is shown as-is");

  await db.insert(readings).values({
    sensorId: sensorA.id,
    organizationId: org.id,
    ts: new Date(windowStart + DISPLAY_WINDOW_MS),
    temperature: 30,
    humidity: 80,
    vpd: 3,
    dewPoint: 9,
  });

  const afterBoundary = await getSmoothedLatestReading(sensorA.id);
  assert(afterBoundary?.temperature === 30, "next window does not mix in the previous one");

  const chart = await getChartSeries({
    organizationId: org.id,
    metric: "temperature",
    from: new Date(windowStart + 2 * 60_000),
    to: new Date(windowStart + DISPLAY_WINDOW_MS),
    sensorIds: [sensorA.id],
  });
  assert(chart.length === 2, "chart returns one point per 5-minute window");
  assert(chart[0].ts.getTime() === windowStart && near(chart[0].value, 19.05), "partial range still uses the whole window");
  assert(chart[1].ts.getTime() === windowStart + DISPLAY_WINDOW_MS && chart[1].value === 30, "boundary point is the next window");

  console.log("smoothing tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
