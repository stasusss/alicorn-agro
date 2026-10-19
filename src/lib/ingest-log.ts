import { getDb } from "@/db";
import { ingestLogs } from "@/db/schema";

export type IngestSensorCount = { id: string; count: number };

export type IngestBatchSummary = {
  sensors: IngestSensorCount[];
  unknownSensors: string[];
  tsFrom: string | null;
  tsTo: string | null;
};

type ReadingStamp = { sensor_external_id: string; ts: string };

/** Counts and time span of one receiver batch. Does not copy the measurements. */
export function summarizeIngestBatch(
  readings: readonly ReadingStamp[],
  unknownSensors: readonly string[],
): IngestBatchSummary {
  const counts = new Map<string, number>();
  let tsFrom: string | null = null;
  let tsTo: string | null = null;

  for (const reading of readings) {
    counts.set(reading.sensor_external_id, (counts.get(reading.sensor_external_id) ?? 0) + 1);
    if (tsFrom === null || reading.ts < tsFrom) tsFrom = reading.ts;
    if (tsTo === null || reading.ts > tsTo) tsTo = reading.ts;
  }

  const unknown = [...new Set(unknownSensors)].slice(0, 20);

  return {
    sensors: [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    unknownSensors: unknown,
    tsFrom,
    tsTo,
  };
}

export function parseIngestSummary(summary: string): IngestBatchSummary {
  try {
    const parsed = JSON.parse(summary) as Partial<IngestBatchSummary>;
    return {
      sensors: Array.isArray(parsed.sensors) ? parsed.sensors : [],
      unknownSensors: Array.isArray(parsed.unknownSensors) ? parsed.unknownSensors : [],
      tsFrom: typeof parsed.tsFrom === "string" ? parsed.tsFrom : null,
      tsTo: typeof parsed.tsTo === "string" ? parsed.tsTo : null,
    };
  } catch {
    return { sensors: [], unknownSensors: [], tsFrom: null, tsTo: null };
  }
}

type IngestLogEvent = {
  status: "ok" | "unauthorized" | "invalid" | "rate_limited";
  gatewayId?: string | null;
  organizationId?: string | null;
  received?: number;
  inserted?: number;
  skippedUnknown?: number;
  summary?: IngestBatchSummary | null;
  error?: string | null;
};

function logLine(event: IngestLogEvent) {
  return JSON.stringify({
    msg: "ingest",
    at: new Date().toISOString(),
    status: event.status,
    gatewayId: event.gatewayId ?? null,
    received: event.received ?? 0,
    inserted: event.inserted ?? 0,
    skippedUnknown: event.skippedUnknown ?? 0,
    sensors: event.summary?.sensors ?? [],
    unknownSensors: event.summary?.unknownSensors ?? [],
    tsFrom: event.summary?.tsFrom ?? null,
    tsTo: event.summary?.tsTo ?? null,
    error: event.error ?? null,
  });
}

/** Console line for every attempt. A row is stored only after the gateway is known. */
export async function recordIngestLog(event: IngestLogEvent) {
  const line = logLine(event);
  if (event.status === "ok") console.info(line);
  else console.warn(line);

  if (!event.gatewayId || !event.organizationId || !event.summary) return;

  try {
    const db = await getDb();
    await db.insert(ingestLogs).values({
      gatewayId: event.gatewayId,
      organizationId: event.organizationId,
      received: event.received ?? 0,
      inserted: event.inserted ?? 0,
      skippedUnknown: event.skippedUnknown ?? 0,
      tsFrom: event.summary.tsFrom ? new Date(event.summary.tsFrom) : null,
      tsTo: event.summary.tsTo ? new Date(event.summary.tsTo) : null,
      summary: JSON.stringify(event.summary),
    });
  } catch (err) {
    console.error("Failed to store ingest log", err);
  }
}
