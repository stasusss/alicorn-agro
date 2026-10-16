import { getDb } from "@/db";
import { organizations, readings, sensors } from "@/db/schema";
import { getDayNightWindow, getUtcDayBounds } from "@/lib/sun";
import { and, asc, avg, eq, gte, lte, sql } from "drizzle-orm";

export async function getOrganization(organizationId: string) {
  const db = await getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org ?? null;
}

export async function getOrgSensors(organizationId: string) {
  const db = await getDb();
  return db
    .select()
    .from(sensors)
    .where(and(eq(sensors.organizationId, organizationId), eq(sensors.active, true)))
    .orderBy(asc(sensors.name));
}

export async function getLatestReadingsBySensor(organizationId: string) {
  const db = await getDb();
  const orgSensors = await getOrgSensors(organizationId);
  const result: Array<{
    sensor: (typeof orgSensors)[number];
    reading: typeof readings.$inferSelect | null;
  }> = [];

  for (const sensor of orgSensors) {
    const [reading] = await db
      .select()
      .from(readings)
      .where(eq(readings.sensorId, sensor.id))
      .orderBy(sql`${readings.ts} desc`)
      .limit(1);
    result.push({ sensor, reading: reading ?? null });
  }

  return result;
}

export async function getTemperatureAggregates(organizationId: string) {
  const db = await getDb();
  const org = await getOrganization(organizationId);
  if (!org) {
    return { dailyAvg: null, dayAvg: null, nightAvg: null };
  }

  const now = new Date();
  const { start: dayStart, end: dayEnd } = getUtcDayBounds(now, org.timezone);
  const window = getDayNightWindow(now, org.latitude, org.longitude);

  const [daily] = await db
    .select({ value: avg(readings.temperature) })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, dayStart),
        lte(readings.ts, dayEnd),
      ),
    );

  const [dayPart] = await db
    .select({ value: avg(readings.temperature) })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, window.sunrise),
        lte(readings.ts, window.sunset),
      ),
    );

  const [nightPart] = await db
    .select({ value: avg(readings.temperature) })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, window.previousSunset),
        lte(readings.ts, window.sunrise),
      ),
    );

  const toNum = (v: string | null) => (v === null ? null : Number(v));

  return {
    dailyAvg: toNum(daily?.value ?? null),
    dayAvg: toNum(dayPart?.value ?? null),
    nightAvg: toNum(nightPart?.value ?? null),
    windows: {
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      sunrise: window.sunrise.toISOString(),
      sunset: window.sunset.toISOString(),
      previousSunset: window.previousSunset.toISOString(),
    },
  };
}

export async function getDailyAvgTemperatureBySensor(organizationId: string) {
  const db = await getDb();
  const org = await getOrganization(organizationId);
  if (!org) return new Map<string, number>();

  const { start, end } = getUtcDayBounds(new Date(), org.timezone);
  const rows = await db
    .select({
      sensorId: readings.sensorId,
      value: avg(readings.temperature),
    })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, start),
        lte(readings.ts, end),
      ),
    )
    .groupBy(readings.sensorId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.value !== null) map.set(row.sensorId, Number(row.value));
  }
  return map;
}

export async function getChartSeries(params: {
  organizationId: string;
  metric: "temperature" | "humidity" | "vpd" | "dew_point";
  from: Date;
  to: Date;
  sensorIds?: string[];
}) {
  const db = await getDb();
  const column =
    params.metric === "temperature"
      ? readings.temperature
      : params.metric === "humidity"
        ? readings.humidity
        : params.metric === "vpd"
          ? readings.vpd
          : readings.dewPoint;

  const conditions = [
    eq(readings.organizationId, params.organizationId),
    gte(readings.ts, params.from),
    lte(readings.ts, params.to),
  ];

  if (params.sensorIds && params.sensorIds.length > 0) {
    conditions.push(
      sql`${readings.sensorId} in (${sql.join(
        params.sensorIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
    );
  }

  return db
    .select({
      sensorId: readings.sensorId,
      ts: readings.ts,
      value: column,
    })
    .from(readings)
    .where(and(...conditions))
    .orderBy(asc(readings.ts));
}
