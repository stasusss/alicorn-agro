import { DELETE, PATCH } from "@/app/api/cabinet/alerts/[id]/route";
import { GET as getAlerts, POST as postAlerts } from "@/app/api/cabinet/alerts/route";
import { GET as getCharts } from "@/app/api/cabinet/charts/route";
import { GET as getExport } from "@/app/api/cabinet/export/route";
import { GET as getHeatmap } from "@/app/api/cabinet/heatmap/route";
import { GET as getReport } from "@/app/api/cabinet/report/route";
import { alertRules, sensors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertReading, seedGateway } from "./helpers/seed";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
});

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

describe("cabinet API without a session", () => {
  it("returns 401 on every protected route", async () => {
    const params = { params: Promise.resolve({ id: crypto.randomUUID() }) };
    const responses = await Promise.all([
      getExport(request("/api/cabinet/export")),
      getReport(request("/api/cabinet/report")),
      getCharts(request("/api/cabinet/charts")),
      getHeatmap(request("/api/cabinet/heatmap")),
      getAlerts(request("/api/cabinet/alerts")),
      postAlerts(request("/api/cabinet/alerts", { method: "POST", body: "{}" })),
      PATCH(request("/api/cabinet/alerts/x", { method: "PATCH", body: "{}" }), params),
      DELETE(request("/api/cabinet/alerts/x", { method: "DELETE" }), params),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401, 401]);
  });
});

describe("cabinet export and alert deletion", () => {
  it("exports only the signed-in organization", async () => {
    const own = await seedGateway("own-key");
    const other = await seedGateway("other-key");
    await own.db.update(sensors).set({ name: 'Зона, "А"', externalId: "own-sensor" }).where(eq(sensors.id, own.sensor.id));
    const ts = new Date("2026-10-19T12:10:00.000Z");
    await insertReading(own.db, {
      sensorId: own.sensor.id,
      organizationId: own.org.id,
      ts,
      temperature: 22,
      humidity: 60,
    });
    await insertReading(other.db, {
      sensorId: other.sensor.id,
      organizationId: other.org.id,
      ts,
      temperature: 99,
      humidity: 10,
    });
    await other.db.update(sensors).set({ externalId: "other-sensor" }).where(eq(sensors.id, other.sensor.id));

    authMock.mockResolvedValue({ user: { organizationId: own.org.id } });
    const response = await getExport(
      request("/api/cabinet/export?from=2026-10-19T12:00:00.000Z&to=2026-10-19T13:00:00.000Z"),
    );
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("own-sensor");
    expect(csv).toContain('"Зона, ""А"""');
    expect(csv).not.toContain("other-sensor");
    expect(csv).not.toContain("99");
  });

  it("logs an alert deletion without the destination", async () => {
    const { db, org } = await seedGateway();
    const destination = "secret-grower@example.com";
    const [rule] = await db
      .insert(alertRules)
      .values({
        organizationId: org.id,
        name: "Лист",
        channel: "email",
        destination,
        targetType: "all_avg",
        metric: "temperature",
        operator: "gt",
        threshold: 30,
      })
      .returning();
    authMock.mockResolvedValue({ user: { organizationId: org.id } });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await DELETE(request(`/api/cabinet/alerts/${rule.id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: rule.id }),
    });
    expect(response.status).toBe(200);
    const line = info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(line).toContain("alert_rule_deleted");
    expect(line).toContain(rule.id);
    expect(line).toContain(org.id);
    expect(line).not.toContain(destination);
    const remaining = await db.select().from(alertRules).where(eq(alertRules.organizationId, org.id));
    expect(remaining).toHaveLength(0);
    info.mockRestore();
  });
});
