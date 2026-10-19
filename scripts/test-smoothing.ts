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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log("ok", message);
}

function near(actual: number, expected: number) {
  return Math.abs(actual - expected) < 1e-9;
}

async function main() {
  const {
    smoothedWindowAverage,
    smoothTimeSeries,
    smoothReadingWindows,
    averageByBucket,
    bucketStartMs,
    DISPLAY_WINDOW_MS,
  } = await import("../src/lib/cabinet/smoothing");
  const { dewPointC, vaporPressureDeficit } = await import("../src/lib/climate");

  const vpdAt25 = 0.6108 * Math.exp((17.27 * 25) / (25 + 237.3)) * (1 - 60 / 100);
  assert(near(vaporPressureDeficit(25, 60), vpdAt25), "VPD formula at 25 °C and 60% RH");
  assert(vaporPressureDeficit(20, 100) === 0, "saturated air has zero VPD");

  const gamma = Math.log(60 / 100) + (17.27 * 25) / (25 + 237.3);
  const dewAt25 = (237.3 * gamma) / (17.27 - gamma);
  assert(near(dewPointC(25, 60), dewAt25), "dew point formula at 25 °C and 60% RH");
  assert(near(dewPointC(20, 100), 20), "saturated air has dew point equal to temperature");

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

  const multi = smoothReadingWindows([
    { ts: new Date(windowStart + 30_000), temperature: 21, humidity: 60 },
    { ts: new Date(windowStart), temperature: 18, humidity: 40 },
    { ts: new Date(windowStart + 45_000), temperature: 20, humidity: 70 },
    { ts: new Date(windowStart + 15_000), temperature: 19, humidity: 50 },
  ]);
  assert(multi.length === 1 && multi[0].count === 4, "all metrics share one window");
  assert(near(multi[0].temperature, 19.05), "temperature in the shared window");
  assert(near(multi[0].humidity, 49), "humidity uses the same formula");
  assert(
    near(multi[0].vpd, vaporPressureDeficit(multi[0].temperature, multi[0].humidity)),
    "vpd is calculated from the 5-minute averages",
  );
  assert(
    near(multi[0].dewPoint, dewPointC(multi[0].temperature, multi[0].humidity)),
    "dew point is calculated from the 5-minute averages",
  );

  const rolled = averageByBucket(
    [
      { ts: new Date(windowStart), value: 19.05 },
      { ts: new Date(windowStart + DISPLAY_WINDOW_MS), value: 30 },
    ],
    10 * 60_000,
  );
  assert(rolled.length === 1 && near(rolled[0].value, 24.525), "wider frame averages the 5-minute values");

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
  assert(
    near(latestA.vpd, vaporPressureDeficit(latestA.temperature, latestA.humidity)),
    "latest vpd comes from the smoothed temperature and humidity",
  );
  assert(
    near(latestA.dewPoint, dewPointC(latestA.temperature, latestA.humidity)),
    "latest dew point comes from the smoothed temperature and humidity",
  );
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

  const humidityChart = await getChartSeries({
    organizationId: org.id,
    metric: "humidity",
    from: new Date(windowStart),
    to: new Date(windowStart + DISPLAY_WINDOW_MS),
    sensorIds: [sensorA.id],
  });
  assert(
    humidityChart.length === 2 && near(humidityChart[0].value, 49) && humidityChart[1].value === 80,
    "humidity chart is one smoothed value per window",
  );

  const vpdChart = await getChartSeries({
    organizationId: org.id,
    metric: "vpd",
    from: new Date(windowStart),
    to: new Date(windowStart + DISPLAY_WINDOW_MS),
    sensorIds: [sensorA.id],
  });
  assert(
    vpdChart.length === 2 &&
      near(vpdChart[0].value, vaporPressureDeficit(chart[0].value, humidityChart[0].value)) &&
      near(vpdChart[1].value, vaporPressureDeficit(30, 80)),
    "vpd chart uses the 5-minute temperature and humidity",
  );

  const dewChart = await getChartSeries({
    organizationId: org.id,
    metric: "dew_point",
    from: new Date(windowStart),
    to: new Date(windowStart + DISPLAY_WINDOW_MS),
    sensorIds: [sensorA.id],
  });
  assert(
    dewChart.length === 2 &&
      near(dewChart[0].value, dewPointC(chart[0].value, humidityChart[0].value)) &&
      near(dewChart[1].value, dewPointC(30, 80)),
    "dew point chart uses the 5-minute temperature and humidity",
  );

  console.log("smoothing tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
