import { getDb } from "@/db";
import { gateways, organizations, readings, sensors } from "@/db/schema";
import {
  DISPLAY_WINDOW_MS,
  averageByBucket,
  bucketStartMs,
  smoothReadingWindows,
  smoothTimeSeries,
  smoothedWindowAverage,
} from "@/lib/cabinet/smoothing";
import { getChartSeries, getSmoothedLatestReading } from "@/lib/cabinet/queries";
import { dewPointC, vaporPressureDeficit } from "@/lib/climate";
import { describe, expect, it } from "vitest";

describe("5-minute smoothing", () => {
  it("follows the customer formula", () => {
    expect(smoothedWindowAverage([])).toBeNull();
    expect(smoothedWindowAverage([7])).toBe(7);
    expect(smoothedWindowAverage([22.5, 22.5, 22.5, 22.5])).toBe(22.5);
    expect(smoothedWindowAverage([10, 11, 12, 9, 13])).toBeCloseTo(10.6, 8);
    expect(smoothedWindowAverage([18, 19, 21, 20])).toBeCloseTo(19.05, 8);
    expect(smoothedWindowAverage(Array.from({ length: 20 }, (_, i) => i + 1))).toBeCloseTo(10.5, 8);
  });

  it("keeps samples in their 5-minute buckets and derives VPD from the averages", () => {
    const windowStart = Date.parse("2026-10-19T12:00:00.000Z");
    expect(bucketStartMs(windowStart + 4 * 60_000)).toBe(windowStart);
    expect(bucketStartMs(windowStart + DISPLAY_WINDOW_MS)).toBe(windowStart + DISPLAY_WINDOW_MS);

    const series = smoothTimeSeries([
      { ts: new Date(windowStart + 30_000), value: 21 },
      { ts: new Date(windowStart), value: 18 },
      { ts: new Date(windowStart + DISPLAY_WINDOW_MS), value: 30 },
      { ts: new Date(windowStart + 45_000), value: 20 },
      { ts: new Date(windowStart + 15_000), value: 19 },
    ]);
    expect(series).toHaveLength(2);
    expect(series[0]?.count).toBe(4);
    expect(series[0]?.value).toBeCloseTo(19.05, 8);
    expect(series[1]).toMatchObject({ count: 1, value: 30 });

    const multi = smoothReadingWindows([
      { ts: new Date(windowStart + 30_000), temperature: 21, humidity: 60 },
      { ts: new Date(windowStart), temperature: 18, humidity: 40 },
      { ts: new Date(windowStart + 45_000), temperature: 20, humidity: 70 },
      { ts: new Date(windowStart + 15_000), temperature: 19, humidity: 50 },
    ]);
    expect(multi).toHaveLength(1);
    expect(multi[0]?.count).toBe(4);
    expect(multi[0]?.temperature).toBeCloseTo(19.05, 8);
    expect(multi[0]?.humidity).toBeCloseTo(49, 8);
    expect(multi[0]?.vpd).toBeCloseTo(vaporPressureDeficit(multi[0]!.temperature, multi[0]!.humidity), 8);
    expect(multi[0]?.dewPoint).toBeCloseTo(dewPointC(multi[0]!.temperature, multi[0]!.humidity), 8);

    const rolled = averageByBucket(
      [
        { ts: new Date(windowStart), value: 19.05 },
        { ts: new Date(windowStart + DISPLAY_WINDOW_MS), value: 30 },
      ],
      10 * 60_000,
    );
    expect(rolled).toHaveLength(1);
    expect(rolled[0]?.value).toBeCloseTo(24.525, 8);
  });

  it("uses the same windows in cabinet queries", async () => {
    const windowStart = Date.parse("2026-10-19T12:00:00.000Z");
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
      .values({ organizationId: org.id, gatewayId: gateway.id, externalId: "s-a", name: "A" })
      .returning();
    const [sensorB] = await db
      .insert(sensors)
      .values({ organizationId: org.id, gatewayId: gateway.id, externalId: "s-b", name: "B" })
      .returning();

    const samples = [
      { offset: 30_000, temperature: 21, humidity: 60 },
      { offset: 0, temperature: 18, humidity: 40 },
      { offset: 45_000, temperature: 20, humidity: 70 },
      { offset: 15_000, temperature: 19, humidity: 50 },
    ];
    await db.insert(readings).values(
      samples.map((sample) => ({
        sensorId: sensorA.id,
        organizationId: org.id,
        ts: new Date(windowStart + sample.offset),
        temperature: sample.temperature,
        humidity: sample.humidity,
        vpd: 1,
        dewPoint: 8,
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
    expect(latestA).not.toBeNull();
    expect(latestA!.temperature).toBeCloseTo(19.05, 8);
    expect(latestA!.humidity).toBeCloseTo(49, 8);
    expect(latestA!.vpd).toBeCloseTo(vaporPressureDeficit(latestA!.temperature, latestA!.humidity), 8);
    expect(latestA!.dewPoint).toBeCloseTo(dewPointC(latestA!.temperature, latestA!.humidity), 8);
    expect(latestA!.ts.getTime()).toBe(windowStart + 45_000);

    const latestB = await getSmoothedLatestReading(sensorB.id);
    expect(latestB?.temperature).toBe(7);

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
    expect(afterBoundary?.temperature).toBe(30);

    const chart = await getChartSeries({
      organizationId: org.id,
      metric: "temperature",
      from: new Date(windowStart + 2 * 60_000),
      to: new Date(windowStart + DISPLAY_WINDOW_MS),
      sensorIds: [sensorA.id],
    });
    expect(chart).toHaveLength(2);
    expect(chart[0]?.ts.getTime()).toBe(windowStart);
    expect(chart[0]?.value).toBeCloseTo(19.05, 8);
    expect(chart[1]?.value).toBe(30);

    const humidityChart = await getChartSeries({
      organizationId: org.id,
      metric: "humidity",
      from: new Date(windowStart),
      to: new Date(windowStart + DISPLAY_WINDOW_MS),
      sensorIds: [sensorA.id],
    });
    expect(humidityChart[0]?.value).toBeCloseTo(49, 8);
    expect(humidityChart[1]?.value).toBe(80);

    const vpdChart = await getChartSeries({
      organizationId: org.id,
      metric: "vpd",
      from: new Date(windowStart),
      to: new Date(windowStart + DISPLAY_WINDOW_MS),
      sensorIds: [sensorA.id],
    });
    expect(vpdChart[0]?.value).toBeCloseTo(vaporPressureDeficit(chart[0]!.value, humidityChart[0]!.value), 8);
    expect(vpdChart[1]?.value).toBeCloseTo(vaporPressureDeficit(30, 80), 8);

    const dewChart = await getChartSeries({
      organizationId: org.id,
      metric: "dew_point",
      from: new Date(windowStart),
      to: new Date(windowStart + DISPLAY_WINDOW_MS),
      sensorIds: [sensorA.id],
    });
    expect(dewChart[0]?.value).toBeCloseTo(dewPointC(chart[0]!.value, humidityChart[0]!.value), 8);
    expect(dewChart[1]?.value).toBeCloseTo(dewPointC(30, 80), 8);
  });
});
