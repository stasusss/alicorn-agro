import { buildAnalyticsReport, renderReportHtml } from "@/lib/cabinet/report";
import { getDataOutages } from "@/lib/cabinet/queries";
import { describe, expect, it } from "vitest";
import { insertReading, seedGateway } from "./helpers/seed";

describe("cabinet queries and report", () => {
  it("builds an empty report when the period has no readings", async () => {
    const { org } = await seedGateway();
    const from = new Date("2026-10-01T00:00:00.000Z");
    const to = new Date("2026-10-02T00:00:00.000Z");
    const report = await buildAnalyticsReport(org.id, from, to);
    expect(report.sampleCount).toBe(0);
    expect(report.sensors).toEqual([]);
    expect(report.problemPeriods).toEqual([]);
    expect(report.organizationName).toBe(org.name);
    const html = renderReportHtml(report);
    expect(html).toContain("Теплиця");
    expect(html).not.toContain("<script");
  });

  it("marks a hot hour as a problem period", async () => {
    const { db, org, sensor } = await seedGateway();
    const ts = new Date("2026-10-19T12:10:00.000Z");
    await insertReading(db, {
      sensorId: sensor.id,
      organizationId: org.id,
      ts,
      temperature: 40,
      humidity: 40,
    });
    const report = await buildAnalyticsReport(
      org.id,
      new Date("2026-10-19T12:00:00.000Z"),
      new Date("2026-10-19T13:00:00.000Z"),
    );
    expect(report.sampleCount).toBe(1);
    expect(report.problemPeriods.length).toBeGreaterThan(0);
    expect(report.problemPeriods[0]?.detail).toContain("висока T");
  });

  it("reports a gap and ignores a short pause", async () => {
    const { db, org, sensor } = await seedGateway();
    const start = new Date("2026-10-19T10:00:00.000Z");
    for (const minutes of [0, 5, 50]) {
      await insertReading(db, {
        sensorId: sensor.id,
        organizationId: org.id,
        ts: new Date(start.getTime() + minutes * 60_000),
        temperature: 22,
        humidity: 60,
      });
    }
    const outages = await getDataOutages(org.id, start, new Date(start.getTime() + 2 * 3600_000), 20);
    expect(outages).toHaveLength(1);
    expect(outages[0]?.minutes).toBe(45);
  });
});
