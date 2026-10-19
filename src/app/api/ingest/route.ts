import { getDb } from "@/db";
import { gateways, readings, sensors } from "@/db/schema";
import { evaluateAlertsForOrganization } from "@/lib/alerts";
import { computeDerivedMetrics } from "@/lib/climate";
import { recordIngestLog, summarizeIngestBatch } from "@/lib/ingest-log";
import { verifyApiKey } from "@/lib/password";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  gateway_id: z.string().uuid(),
  readings: z
    .array(
      z.object({
        sensor_external_id: z.string().min(1).max(64),
        ts: z.string().datetime({ offset: true }),
        temperature: z.number().finite(),
        humidity: z.number().min(0).max(100),
      }),
    )
    .min(1)
    .max(5000),
});

const recentIngests = new Map<string, number[]>();

function rateLimited(gatewayId: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const stamps = (recentIngests.get(gatewayId) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    recentIngests.set(gatewayId, stamps);
    return true;
  }
  stamps.push(now);
  recentIngests.set(gatewayId, stamps);
  return false;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    await recordIngestLog({ status: "unauthorized", error: "missing bearer token" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) {
    await recordIngestLog({ status: "unauthorized", error: "empty bearer token" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    await recordIngestLog({ status: "invalid", error: "invalid JSON" });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    await recordIngestLog({ status: "invalid", error: "validation failed" });
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { gateway_id, readings: batch } = parsed.data;

  if (rateLimited(gateway_id)) {
    await recordIngestLog({
      status: "rate_limited",
      gatewayId: gateway_id,
      received: batch.length,
      summary: summarizeIngestBatch(batch, []),
    });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const db = await getDb();
  const [gateway] = await db.select().from(gateways).where(eq(gateways.id, gateway_id)).limit(1);
  if (!gateway || !verifyApiKey(apiKey, gateway.apiKeyHash)) {
    await recordIngestLog({
      status: "unauthorized",
      gatewayId: gateway?.id ?? gateway_id,
      organizationId: gateway?.organizationId,
      received: batch.length,
      error: gateway ? "bad api key" : "unknown gateway",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gatewaySensors = await db
    .select()
    .from(sensors)
    .where(and(eq(sensors.gatewayId, gateway.id), eq(sensors.active, true)));

  const byExternal = new Map(gatewaySensors.map((s) => [s.externalId, s]));

  const rows: (typeof readings.$inferInsert)[] = [];
  const unknownSensors: string[] = [];

  for (const item of batch) {
    const sensor = byExternal.get(item.sensor_external_id);
    if (!sensor) {
      unknownSensors.push(item.sensor_external_id);
      continue;
    }
    const derived = computeDerivedMetrics(item.temperature, item.humidity);
    rows.push({
      sensorId: sensor.id,
      organizationId: gateway.organizationId,
      ts: new Date(item.ts),
      temperature: item.temperature,
      humidity: item.humidity,
      vpd: derived.vpd,
      dewPoint: derived.dewPoint,
    });
  }

  let inserted = 0;
  if (rows.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const result = await db
        .insert(readings)
        .values(chunk)
        .onConflictDoNothing({ target: [readings.sensorId, readings.ts] })
        .returning({ id: readings.id });
      inserted += result.length;
    }
  }

  await db.update(gateways).set({ lastSeenAt: new Date() }).where(eq(gateways.id, gateway.id));

  const summary = summarizeIngestBatch(batch, unknownSensors);
  await recordIngestLog({
    status: "ok",
    gatewayId: gateway.id,
    organizationId: gateway.organizationId,
    received: batch.length,
    inserted,
    skippedUnknown: unknownSensors.length,
    summary,
  });

  try {
    await evaluateAlertsForOrganization(gateway.organizationId);
  } catch (err) {
    console.error("Alert evaluation failed", err);
  }

  return NextResponse.json({
    ok: true,
    received: batch.length,
    inserted,
    skipped_unknown_sensors: unknownSensors.length,
  });
}
