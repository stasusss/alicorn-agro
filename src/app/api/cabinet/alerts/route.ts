import { getDb } from "@/db";
import { alertRules } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canReadMeasurements } from "@/lib/cabinet/measurement-access";
import { logger, requestIdFrom } from "@/lib/log";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(["telegram", "email"]),
  destination: z.string().min(1).max(320),
  targetType: z.enum(["sensor", "all_avg"]),
  sensorId: z.string().uuid().nullable().optional(),
  metric: z.enum(["temperature", "humidity", "vpd", "dew_point"]),
  operator: z.enum(["gt", "lt", "gte", "lte"]),
  threshold: z.number().finite(),
  cooldownMinutes: z.number().int().min(1).max(24 * 60).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      logger.warn({ msg: "cabinet_unauthorized", requestId, route: "alerts" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReadMeasurements(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await getDb();
    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.organizationId, session.user.organizationId));

    return NextResponse.json({ rules });
  } catch (err) {
    logger.error({ msg: "cabinet_failed", requestId, route: "alerts", err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      logger.warn({ msg: "cabinet_unauthorized", requestId, route: "alerts" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReadMeasurements(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "alerts" });
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    if (parsed.data.targetType === "sensor" && !parsed.data.sensorId) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "alerts" });
      return NextResponse.json({ error: "sensorId required" }, { status: 400 });
    }

    if (parsed.data.channel === "email" && !z.string().email().safeParse(parsed.data.destination).success) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "alerts" });
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const db = await getDb();
    const [rule] = await db
      .insert(alertRules)
      .values({
        organizationId: session.user.organizationId,
        name: parsed.data.name,
        channel: parsed.data.channel,
        destination: parsed.data.destination,
        targetType: parsed.data.targetType,
        sensorId: parsed.data.targetType === "sensor" ? parsed.data.sensorId! : null,
        metric: parsed.data.metric,
        operator: parsed.data.operator,
        threshold: parsed.data.threshold,
        cooldownMinutes: parsed.data.cooldownMinutes ?? 30,
      })
      .returning();

    return NextResponse.json({
      id: rule.id,
      name: rule.name,
      channel: rule.channel,
      destination: rule.destination,
      targetType: rule.targetType,
      sensorId: rule.sensorId,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      cooldownMinutes: rule.cooldownMinutes,
      enabled: rule.enabled,
    });
  } catch (err) {
    logger.error({ msg: "cabinet_failed", requestId, route: "alerts", err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
