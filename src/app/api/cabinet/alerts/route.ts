import { getDb } from "@/db";
import { alertRules } from "@/db/schema";
import { auth } from "@/lib/auth";
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const rules = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.organizationId, session.user.organizationId));

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (parsed.data.targetType === "sensor" && !parsed.data.sensorId) {
    return NextResponse.json({ error: "sensorId required" }, { status: 400 });
  }

  if (parsed.data.channel === "email" && !z.string().email().safeParse(parsed.data.destination).success) {
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
}
