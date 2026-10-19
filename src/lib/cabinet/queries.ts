import { getDb } from "@/db";
import { gateways, organizations, readings, sensors } from "@/db/schema";
import {
  averageByBucket,
  bucketStartMs,
  DISPLAY_WINDOW_MS,
  smoothReadingWindows,
  smoothTimeSeries,
} from "@/lib/cabinet/smoothing";
import { getDayNightWindow, getUtcDayBounds } from "@/lib/sun";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";

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
  const [window] = smoothReadingWindows(rows);
  if (!window) return null;
  const last = rows[rows.length - 1];

  return {
    ...last,
    temperature: window.temperature,
    humidity: window.humidity,
    vpd: window.vpd,
    dewPoint: window.dewPoint,
  };
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** One smoothed temperature per sensor per 5-minute window that overlaps [from, to]. */
async function smoothedTemperatures(organizationId: string, from: Date, to: Date) {
  const db = await getDb();
  const rows = await db
    .select({
      sensorId: readings.sensorId,
      ts: readings.ts,
      value: readings.temperature,
    })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, new Date(bucketStartMs(from.getTime()))),
        lte(readings.ts, to),
      ),
    )
    .orderBy(asc(readings.ts));

  const bySensor = new Map<string, { ts: Date; value: number }[]>();
  for (const row of rows) {
    const list = bySensor.get(row.sensorId) ?? [];
    list.push({ ts: row.ts, value: row.value });
    bySensor.set(row.sensorId, list);
  }

  const points: { sensorId: string; ts: Date; value: number }[] = [];
  for (const [sensorId, series] of bySensor) {
    for (const window of smoothTimeSeries(series)) {
      const start = window.ts.getTime();
      if (start + DISPLAY_WINDOW_MS <= from.getTime() || start > to.getTime()) continue;
      points.push({ sensorId, ts: window.ts, value: window.value });
    }
  }
  return points;
}

function meanTemperatureBetween(
  points: { ts: Date; value: number }[],
  from: Date,
  to: Date,
) {
  return mean(
    points
      .filter((point) => point.ts >= from && point.ts <= to)
      .map((point) => point.value),
  );
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
  const org = await getOrganization(organizationId);
  if (!org) {
    return { dailyAvg: null, dayAvg: null, nightAvg: null };
  }

  const now = new Date();
  const { start: dayStart, end: dayEnd } = getUtcDayBounds(now, org.timezone);
  const window = getDayNightWindow(now, org.latitude, org.longitude);
  const spanFrom = window.previousSunset < dayStart ? window.previousSunset : dayStart;
  const spanTo = window.sunset > dayEnd ? window.sunset : dayEnd;
  const points = await smoothedTemperatures(organizationId, spanFrom, spanTo);

  return {
    dailyAvg: meanTemperatureBetween(points, dayStart, dayEnd),
    dayAvg: meanTemperatureBetween(points, window.sunrise, window.sunset),
    nightAvg: meanTemperatureBetween(points, window.previousSunset, window.sunrise),
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
  const org = await getOrganization(organizationId);
  if (!org) return new Map<string, number>();

  const { start, end } = getUtcDayBounds(new Date(), org.timezone);
  const points = await smoothedTemperatures(organizationId, start, end);
  const bySensor = new Map<string, number[]>();
  for (const point of points) {
    if (point.ts < start || point.ts > end) continue;
    const list = bySensor.get(point.sensorId) ?? [];
    list.push(point.value);
    bySensor.set(point.sensorId, list);
  }

  const map = new Map<string, number>();
  for (const [sensorId, values] of bySensor) {
    const value = mean(values);
    if (value !== null) map.set(sensorId, value);
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

  const smoothed: { sensorId: string; ts: Date; value: number }[] = [];

  if (params.metric === "vpd" || params.metric === "dew_point") {
    const rows = await db
      .select({
        sensorId: readings.sensorId,
        ts: readings.ts,
        temperature: readings.temperature,
        humidity: readings.humidity,
      })
      .from(readings)
      .where(and(...conditions))
      .orderBy(asc(readings.ts));

    const bySensor = new Map<string, { ts: Date; temperature: number; humidity: number }[]>();
    for (const row of rows) {
      const list = bySensor.get(row.sensorId) ?? [];
      list.push(row);
      bySensor.set(row.sensorId, list);
    }

    for (const [sensorId, points] of bySensor) {
      for (const window of smoothReadingWindows(points)) {
        smoothed.push({
          sensorId,
          ts: window.ts,
          value: params.metric === "vpd" ? window.vpd : window.dewPoint,
        });
      }
    }
  } else {
    const rows = await db
      .select({
        sensorId: readings.sensorId,
        ts: readings.ts,
        value: params.metric === "temperature" ? readings.temperature : readings.humidity,
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

    for (const [sensorId, points] of bySensor) {
      for (const bucket of smoothTimeSeries(points)) {
        smoothed.push({ sensorId, ts: bucket.ts, value: bucket.value });
      }
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
  const bucket = heatmapBucketSeconds(params.from, params.to);
  const points = await smoothedTemperatures(params.organizationId, params.from, params.to);
  const bySensor = new Map<string, { ts: Date; value: number }[]>();
  for (const point of points) {
    const list = bySensor.get(point.sensorId) ?? [];
    list.push({ ts: point.ts, value: point.value });
    bySensor.set(point.sensorId, list);
  }

  const byBucket = new Map<number, Record<string, number>>();
  for (const [sensorId, series] of bySensor) {
    for (const frame of averageByBucket(series, bucket * 1000)) {
      const slot = byBucket.get(frame.ts.getTime()) ?? {};
      slot[sensorId] = frame.value;
      byBucket.set(frame.ts.getTime(), slot);
    }
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

  const todayPoints = await smoothedTemperatures(organizationId, hourStart, now);
  const yesterdayPoints = await smoothedTemperatures(organizationId, yStart, yEnd);
  const todayAvg = meanTemperatureBetween(todayPoints, hourStart, now);
  const yesterdayAvg = meanTemperatureBetween(yesterdayPoints, yStart, yEnd);

  if (todayAvg === null || yesterdayAvg === null) {
    return { todayAvg, yesterdayAvg, delta: null as number | null };
  }

  return {
    todayAvg,
    yesterdayAvg,
    delta: todayAvg - yesterdayAvg,
  };
}
