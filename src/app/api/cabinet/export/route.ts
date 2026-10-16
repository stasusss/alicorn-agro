import { getDb } from "@/db";
import { readings, sensors } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

function csvEscape(value: string | number) {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (to.getTime() - from.getTime() > 90 * 24 * 3600 * 1000) {
    return NextResponse.json({ error: "Max range is 90 days" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select({
      ts: readings.ts,
      temperature: readings.temperature,
      humidity: readings.humidity,
      vpd: readings.vpd,
      dewPoint: readings.dewPoint,
      sensorName: sensors.name,
      sensorExternalId: sensors.externalId,
    })
    .from(readings)
    .innerJoin(sensors, eq(sensors.id, readings.sensorId))
    .where(
      and(
        eq(readings.organizationId, session.user.organizationId),
        gte(readings.ts, from),
        lte(readings.ts, to),
      ),
    )
    .orderBy(asc(readings.ts), asc(sensors.name));

  const header = [
    "ts_utc",
    "sensor_external_id",
    "sensor_name",
    "temperature_c",
    "humidity_pct",
    "vpd_kpa",
    "dew_point_c",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.ts.toISOString()),
        csvEscape(row.sensorExternalId),
        csvEscape(row.sensorName),
        csvEscape(row.temperature),
        csvEscape(row.humidity),
        csvEscape(row.vpd),
        csvEscape(row.dewPoint),
      ].join(","),
    );
  }

  const filename = `alicorn-readings-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
