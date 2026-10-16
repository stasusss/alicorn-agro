import { auth } from "@/lib/auth";
import { getChartSeries, getOrgSensors } from "@/lib/cabinet/queries";
import type { MetricKey } from "@/lib/climate";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  metric: z.enum(["temperature", "humidity", "vpd", "dew_point"]),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  sensors: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    metric: url.searchParams.get("metric"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    sensors: url.searchParams.get("sensors") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const orgSensors = await getOrgSensors(session.user.organizationId);
  const allowed = new Set(orgSensors.map((s) => s.id));
  const requested = parsed.data.sensors
    ? parsed.data.sensors.split(",").filter((id) => allowed.has(id))
    : orgSensors.map((s) => s.id);

  const rows = await getChartSeries({
    organizationId: session.user.organizationId,
    metric: parsed.data.metric as MetricKey,
    from: new Date(parsed.data.from),
    to: new Date(parsed.data.to),
    sensorIds: requested,
  });

  const bySensor = new Map<string, { ts: string; value: number }[]>();
  for (const row of rows) {
    const list = bySensor.get(row.sensorId) ?? [];
    list.push({ ts: row.ts.toISOString(), value: Number(row.value) });
    bySensor.set(row.sensorId, list);
  }

  const nameById = new Map(orgSensors.map((s) => [s.id, s.name]));

  return NextResponse.json({
    series: requested.map((id) => ({
      sensorId: id,
      name: nameById.get(id) ?? id,
      points: bySensor.get(id) ?? [],
    })),
  });
}
