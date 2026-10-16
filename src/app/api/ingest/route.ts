import { getDb } from "@/db";
import { gateways, readings, sensors } from "@/db/schema";
import { evaluateAlertsForOrganization } from "@/lib/alerts";
import { computeDerivedMetrics } from "@/lib/climate";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { gateway_id, readings: batch } = parsed.data;

  if (rateLimited(gateway_id)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const db = await getDb();
  const [gateway] = await db.select().from(gateways).where(eq(gateways.id, gateway_id)).limit(1);
  if (!gateway || !verifyApiKey(apiKey, gateway.apiKeyHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gatewaySensors = await db
    .select()
    .from(sensors)
    .where(and(eq(sensors.gatewayId, gateway.id), eq(sensors.active, true)));

  const byExternal = new Map(gatewaySensors.map((s) => [s.externalId, s]));

  const rows: (typeof readings.$inferInsert)[] = [];
  let skippedUnknown = 0;

  for (const item of batch) {
    const sensor = byExternal.get(item.sensor_external_id);
    if (!sensor) {
      skippedUnknown += 1;
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

  try {
    await evaluateAlertsForOrganization(gateway.organizationId);
  } catch (err) {
    console.error("Alert evaluation failed", err);
  }

  return NextResponse.json({
    ok: true,
    received: batch.length,
    inserted,
    skipped_unknown_sensors: skippedUnknown,
  });
}
