import { getDb } from "@/db";
import { gateways, organizations, readings, sensors } from "@/db/schema";
import { bucketStartMs, DISPLAY_WINDOW_MS, smoothedWindowAverage, smoothTimeSeries } from "@/lib/cabinet/smoothing";
import { getDayNightWindow, getUtcDayBounds } from "@/lib/sun";
import { and, asc, avg, desc, eq, gte, lt, lte, sql } from "drizzle-orm";

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

/** Latest 5-minute window for one sensor, smoothed. `ts` stays the last raw sample. */
export async function getSmoothedLatestReading(sensorId: string) {
  const db = await getDb();
  const [latest] = await db
    .select({ ts: readings.ts })
    .from(readings)
    .where(eq(readings.sensorId, sensorId))
    .orderBy(desc(readings.ts))
    .limit(1);
  if (!latest) return null;

  const start = new Date(bucketStartMs(latest.ts.getTime()));
  const end = new Date(start.getTime() + DISPLAY_WINDOW_MS);
  const rows = await db
    .select()
    .from(readings)
    .where(and(eq(readings.sensorId, sensorId), gte(readings.ts, start), lt(readings.ts, end)))
    .orderBy(asc(readings.ts));
  if (rows.length === 0) return null;

  const last = rows[rows.length - 1];
  const smooth = (pick: (row: (typeof rows)[number]) => number) => {
    const value = smoothedWindowAverage(rows.map(pick));
    return value === null ? pick(last) : value;
  };

  return {
    ...last,
    temperature: smooth((row) => row.temperature),
    humidity: smooth((row) => row.humidity),
    vpd: smooth((row) => row.vpd),
    dewPoint: smooth((row) => row.dewPoint),
  };
}

export async function getLatestReadingsBySensor(organizationId: string) {
  const orgSensors = await getOrgSensors(organizationId);
  const result: Array<{
    sensor: (typeof orgSensors)[number];
    reading: typeof readings.$inferSelect | null;
  }> = [];

  for (const sensor of orgSensors) {
    result.push({ sensor, reading: await getSmoothedLatestReading(sensor.id) });
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
    gte(readings.ts, new Date(bucketStartMs(params.from.getTime()))),
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

  const rows = await db
    .select({
      sensorId: readings.sensorId,
      ts: readings.ts,
      value: column,
    })
    .from(readings)
    .where(and(...conditions))
    .orderBy(asc(readings.ts));

  const bySensor = new Map<string, { ts: Date; value: number }[]>();
  for (const row of rows) {
    const list = bySensor.get(row.sensorId) ?? [];
    list.push({ ts: row.ts, value: Number(row.value) });
    bySensor.set(row.sensorId, list);
  }

  const smoothed: { sensorId: string; ts: Date; value: number }[] = [];
  for (const [sensorId, points] of bySensor) {
    for (const bucket of smoothTimeSeries(points)) {
      smoothed.push({ sensorId, ts: bucket.ts, value: bucket.value });
    }
  }

  smoothed.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  return smoothed;
}

const HEATMAP_BUCKETS_SEC = [300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];

/** Bucket width that yields about 90 frames, so a day plays back in under a minute. */
export function heatmapBucketSeconds(from: Date, to: Date) {
  const spanMs = Math.max(60_000, to.getTime() - from.getTime());
  const rawSec = spanMs / 90 / 1000;
  return HEATMAP_BUCKETS_SEC.find((step) => step >= rawSec) ?? 86_400;
}

export type HeatmapFrame = { ts: string; temps: Record<string, number> };

export async function getHeatmapFrames(params: {
  organizationId: string;
  from: Date;
  to: Date;
}) {
  const db = await getDb();
  const bucket = heatmapBucketSeconds(params.from, params.to);
  const result = await db.execute<{
    sensorId: string;
    bucket: string;
    temperature: number | string;
  }>(sql`
    select
      sensor_id as "sensorId",
      to_timestamp(floor(extract(epoch from ts) / ${bucket}) * ${bucket}) as bucket,
      avg(temperature) as temperature
    from readings
    where organization_id = ${params.organizationId}::uuid
      and ts >= ${params.from}
      and ts <= ${params.to}
    group by sensor_id, bucket
    order by bucket
  `);
  const rows = Array.isArray(result) ? result : result.rows;

  const byBucket = new Map<number, Record<string, number>>();
  for (const row of rows) {
    if (row.temperature === null) continue;
    const time = new Date(row.bucket).getTime();
    if (!Number.isFinite(time)) continue;
    const slot = byBucket.get(time) ?? {};
    slot[row.sensorId] = Number(row.temperature);
    byBucket.set(time, slot);
  }

  const times = [...byBucket.keys()].sort((a, b) => a - b);
  const carry: Record<string, number> = {};
  let previous = Number.NEGATIVE_INFINITY;
  const frames: HeatmapFrame[] = times.map((time) => {
    if (time - previous > bucket * 2 * 1000) {
      for (const key of Object.keys(carry)) delete carry[key];
    }
    const actual = byBucket.get(time) ?? {};
    const temps = { ...carry, ...actual };
    Object.assign(carry, actual);
    previous = time;
    return { ts: new Date(time).toISOString(), temps };
  });

  return { bucketMinutes: bucket / 60, frames };
}

export async function getGatewayStatus(organizationId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(gateways)
    .where(eq(gateways.organizationId, organizationId))
    .orderBy(desc(gateways.lastSeenAt));

  const lastSeenAt = rows.reduce<Date | null>((best, g) => {
    if (!g.lastSeenAt) return best;
    if (!best || g.lastSeenAt > best) return g.lastSeenAt;
    return best;
  }, null);

  return {
    gateways: rows,
    lastSeenAt,
    count: rows.length,
  };
}

export async function getFreshestReadingTs(organizationId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ ts: readings.ts })
    .from(readings)
    .where(eq(readings.organizationId, organizationId))
    .orderBy(desc(readings.ts))
    .limit(1);
  return row?.ts ?? null;
}

/** Detect gaps > gapMinutes between consecutive readings (any sensor stream merged). */
export async function getDataOutages(
  organizationId: string,
  from: Date,
  to: Date,
  gapMinutes = 20,
) {
  const db = await getDb();
  const rows = await db
    .select({ ts: readings.ts })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, from),
        lte(readings.ts, to),
      ),
    )
    .orderBy(asc(readings.ts));

  const uniqueTs = [...new Set(rows.map((r) => r.ts.getTime()))].sort((a, b) => a - b);
  const gapMs = gapMinutes * 60_000;
  const outages: { from: Date; to: Date; minutes: number }[] = [];

  for (let i = 1; i < uniqueTs.length; i++) {
    const delta = uniqueTs[i] - uniqueTs[i - 1];
    if (delta >= gapMs) {
      outages.push({
        from: new Date(uniqueTs[i - 1]),
        to: new Date(uniqueTs[i]),
        minutes: Math.round(delta / 60_000),
      });
    }
  }

  return outages.slice(0, 20);
}

/** Compare current hour avg T today vs same clock hour yesterday. */
export async function getDayOverDayTempCompare(organizationId: string) {
  const org = await getOrganization(organizationId);
  if (!org) return null;

  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60_000);

  const yStart = new Date(hourStart.getTime() - 24 * 60 * 60_000);
  const yEnd = new Date(hourEnd.getTime() - 24 * 60 * 60_000);

  const db = await getDb();
  const [today] = await db
    .select({ value: avg(readings.temperature) })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, hourStart),
        lte(readings.ts, now),
      ),
    );
  const [yesterday] = await db
    .select({ value: avg(readings.temperature) })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, yStart),
        lte(readings.ts, yEnd),
      ),
    );

  const todayAvg = today?.value === null || today?.value === undefined ? null : Number(today.value);
  const yesterdayAvg =
    yesterday?.value === null || yesterday?.value === undefined ? null : Number(yesterday.value);

  if (todayAvg === null || yesterdayAvg === null) {
    return { todayAvg, yesterdayAvg, delta: null as number | null };
  }

  return {
    todayAvg,
    yesterdayAvg,
    delta: todayAvg - yesterdayAvg,
  };
}
