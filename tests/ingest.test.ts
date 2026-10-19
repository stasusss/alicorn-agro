import { readings, ingestLogs, gateways } from "@/db/schema";
import { POST } from "@/app/api/ingest/route";
import { IngestChunkError, insertReadingsInTransaction } from "@/lib/ingest-write";
import { computeDerivedMetrics } from "@/lib/climate";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedGateway } from "./helpers/seed";

afterEach(() => {
  vi.restoreAllMocks();
});

function post(body: unknown, apiKey?: string, requestId = "req-ingest") {
  const headers = new Headers({ "content-type": "application/json", "x-request-id": requestId });
  if (apiKey !== undefined) headers.set("authorization", `Bearer ${apiKey}`);
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function batch(gatewayId: string, readingsBatch: unknown[]) {
  return { gateway_id: gatewayId, readings: readingsBatch };
}

describe("POST /api/ingest", () => {
  it("rejects missing credentials, bad JSON, and an invalid body", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post("{", "not-a-key"))).status).toBe(400);
    const gatewayId = crypto.randomUUID();
    const invalid = await POST(
      post(batch(gatewayId, [{ sensor_external_id: "s1", ts: "2026-10-19T12:00:00.000Z", temperature: 20, humidity: 140 }]), "k"),
    );
    expect(invalid.status).toBe(400);
    expect(warn.mock.calls.map((call) => String(call[0])).join("\n")).not.toContain("Bearer");
  });

  it("rate limits a gateway id before it is authenticated", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const gatewayId = crypto.randomUUID();
    const body = batch(gatewayId, [
      { sensor_external_id: "s1", ts: "2026-10-19T12:00:00.000Z", temperature: 20, humidity: 60 },
    ]);
    for (let i = 0; i < 30; i++) {
      expect((await POST(post(body, "nope"))).status).toBe(401);
    }
    expect((await POST(post(body, "nope"))).status).toBe(429);
  });

  it("stores derived metrics once and ignores a replay and unknown sensors", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, gateway, sensor, apiKey } = await seedGateway("super-secret-key");
    const ts = "2026-10-19T12:00:00.000Z";
    const payload = batch(gateway.id, [
      { sensor_external_id: "s1", ts, temperature: 25, humidity: 60 },
      { sensor_external_id: "missing", ts, temperature: 25, humidity: 60 },
    ]);

    const first = await POST(post(payload, apiKey, "batch-1"));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, received: 2, inserted: 1, skipped_unknown_sensors: 1 });

    const second = await POST(post(payload, apiKey, "batch-2"));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ inserted: 0, skipped_unknown_sensors: 1 });

    const stored = await db.select().from(readings).where(eq(readings.sensorId, sensor.id));
    expect(stored).toHaveLength(1);
    const derived = computeDerivedMetrics(25, 60);
    expect(stored[0]?.vpd).toBe(derived.vpd);
    expect(stored[0]?.dewPoint).toBe(derived.dewPoint);

    const [gatewayRow] = await db.select().from(gateways).where(eq(gateways.id, gateway.id));
    expect(gatewayRow?.lastSeenAt).toBeInstanceOf(Date);

    const logs = await db.select().from(ingestLogs).where(eq(ingestLogs.gatewayId, gateway.id));
    expect(logs.map((row) => row.summary).join("\n")).toContain("batch-1");
    expect(logs.map((row) => row.summary).join("\n")).toContain("batch-2");

    const unknown = await POST(post(payload, "wrong-key", "batch-3"));
    expect(unknown.status).toBe(401);
    const logged = [...info.mock.calls, ...warn.mock.calls].map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain("super-secret-key");
    expect(logged).not.toContain("wrong-key");
  });

  it("rolls back the whole batch when a later chunk fails", async () => {
    const { db, org, sensor } = await seedGateway();
    const base = {
      organizationId: org.id,
      temperature: 21,
      humidity: 55,
      vpd: 1,
      dewPoint: 9,
    };
    await expect(
      insertReadingsInTransaction(
        db,
        [
          { ...base, sensorId: sensor.id, ts: new Date("2026-10-19T12:00:00.000Z") },
          {
            ...base,
            sensorId: "00000000-0000-0000-0000-000000000099",
            ts: new Date("2026-10-19T12:00:15.000Z"),
          },
        ],
        1,
      ),
    ).rejects.toBeInstanceOf(IngestChunkError);
    const left = await db.select().from(readings).where(eq(readings.organizationId, org.id));
    expect(left).toHaveLength(0);
  });
});
