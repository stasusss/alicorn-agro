import { getDb } from "@/db";
import { readings, sensors } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canReadMeasurements } from "@/lib/cabinet/measurement-access";
import { bucketStartMs, DISPLAY_WINDOW_MS, smoothReadingWindows } from "@/lib/cabinet/smoothing";
import { logger, requestIdFrom } from "@/lib/log";
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
  const requestId = requestIdFrom(request);
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      logger.warn({ msg: "cabinet_unauthorized", requestId, route: "export" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReadMeasurements(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });

    if (!parsed.success) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "export" });
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    if (to.getTime() - from.getTime() > 90 * 24 * 3600 * 1000) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "export" });
      return NextResponse.json({ error: "Max range is 90 days" }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db
      .select({
        sensorId: readings.sensorId,
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
          gte(readings.ts, new Date(bucketStartMs(from.getTime()))),
          lte(readings.ts, to),
        ),
      )
      .orderBy(asc(readings.ts), asc(sensors.name));

    const bySensor = new Map<
      string,
      {
        name: string;
        externalId: string;
        points: { ts: Date; temperature: number; humidity: number; vpd: number; dewPoint: number }[];
      }
    >();
    for (const row of rows) {
      const group = bySensor.get(row.sensorId) ?? {
        name: row.sensorName,
        externalId: row.sensorExternalId,
        points: [],
      };
      group.points.push(row);
      bySensor.set(row.sensorId, group);
    }

    const windows: {
      ts: Date;
      externalId: string;
      name: string;
      temperature: number;
      humidity: number;
      vpd: number;
      dewPoint: number;
    }[] = [];
    for (const group of bySensor.values()) {
      for (const window of smoothReadingWindows(group.points)) {
        const start = window.ts.getTime();
        if (start + DISPLAY_WINDOW_MS <= from.getTime() || start > to.getTime()) continue;
        windows.push({
          ts: window.ts,
          externalId: group.externalId,
          name: group.name,
          temperature: window.temperature,
          humidity: window.humidity,
          vpd: window.vpd,
          dewPoint: window.dewPoint,
        });
      }
    }
    windows.sort((a, b) => a.ts.getTime() - b.ts.getTime() || a.name.localeCompare(b.name, "uk"));

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
    for (const row of windows) {
      lines.push(
        [
          csvEscape(row.ts.toISOString()),
          csvEscape(row.externalId),
          csvEscape(row.name),
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
  } catch (err) {
    logger.error({ msg: "cabinet_failed", requestId, route: "export", err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
