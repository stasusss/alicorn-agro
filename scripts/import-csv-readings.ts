/**
 * Import greenhouse temperature CSV into the test client DB.
 *
 * CSV columns: Time, Датчик 101 … Датчик 404 (temperature only).
 * Humidity is estimated from T so VPD / dew point charts still work.
 *
 * Usage: npm run db:import-csv
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { gateways, organizations, readings, sensors } from "../src/db/schema";
import { computeDerivedMetrics } from "../src/lib/climate";

const DEFAULT_CSV = resolve(
  process.cwd(),
  "data/greenhouse-temps-2026-10-16.csv",
);

/** Ukraine is on EEST (UTC+3) on 2026-10-16. */
const LOCAL_OFFSET = "+03:00";

function parseTemp(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return Number(match[0]);
}

/** Plausible greenhouse RH when CSV has temperature only. */
function estimateHumidity(temperatureC: number): number {
  const rh = 82 - (temperatureC - 18) * 2.2;
  return Math.round(Math.min(92, Math.max(52, rh)) * 10) / 10;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("CSV is empty");

  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  if (header[0] !== "Time") throw new Error(`Unexpected first column: ${header[0]}`);

  const sensorHeaders = header.slice(1);
  const rows: { ts: Date; values: (number | null)[] }[] = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const timeRaw = cols[0]?.replace(/^"|"$/g, "");
    if (!timeRaw) continue;
    const iso = `${timeRaw.replace(" ", "T")}${LOCAL_OFFSET}`;
    const ts = new Date(iso);
    if (Number.isNaN(ts.getTime())) {
      console.warn("Skip bad timestamp", timeRaw);
      continue;
    }
    const values = sensorHeaders.map((_, i) => parseTemp(cols[i + 1] ?? ""));
    rows.push({ ts, values });
  }

  return { sensorHeaders, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function externalIdFromHeader(header: string): string {
  const match = header.match(/(\d+)/);
  if (!match) throw new Error(`Cannot parse sensor id from "${header}"`);
  return `s${match[1]}`;
}

function positionForExternalId(externalId: string): { x: number; y: number } {
  // 101..104 row 0, 201..204 row 1, …
  const n = Number(externalId.replace(/^s/, ""));
  const row = Math.floor(n / 100) - 1; // 0..3
  const col = (n % 100) - 1; // 0..3
  return {
    x: 0.12 + col * 0.25,
    y: 0.15 + row * 0.23,
  };
}

async function main() {
  const csvPath = resolve(process.env.CSV_PATH ?? DEFAULT_CSV);
  const { sensorHeaders, rows } = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Parsed ${rows.length} timestamps × ${sensorHeaders.length} sensors from ${csvPath}`);

  const db = await getDb();
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error("No organization — run npm run db:seed first");

  const [gateway] = await db
    .select()
    .from(gateways)
    .where(eq(gateways.organizationId, org.id))
    .limit(1);
  if (!gateway) throw new Error("No gateway — run npm run db:seed first");

  // Replace previous demo sensors/readings for a clean test dataset
  await db.delete(readings).where(eq(readings.organizationId, org.id));
  await db.delete(sensors).where(eq(sensors.organizationId, org.id));

  const sensorIds: string[] = [];
  for (const header of sensorHeaders) {
    const externalId = externalIdFromHeader(header);
    const pos = positionForExternalId(externalId);
    const [sensor] = await db
      .insert(sensors)
      .values({
        organizationId: org.id,
        gatewayId: gateway.id,
        externalId,
        name: header.replace(/^"|"$/g, ""),
        positionX: pos.x,
        positionY: pos.y,
        active: true,
      })
      .returning();
    sensorIds.push(sensor.id);
  }
  console.log(`Created ${sensorIds.length} sensors`);

  const batch: (typeof readings.$inferInsert)[] = [];
  for (const row of rows) {
    for (let i = 0; i < sensorIds.length; i++) {
      const temperature = row.values[i];
      if (temperature === null) continue;
      const humidity = estimateHumidity(temperature);
      const derived = computeDerivedMetrics(temperature, humidity);
      batch.push({
        sensorId: sensorIds[i],
        organizationId: org.id,
        ts: row.ts,
        temperature,
        humidity,
        vpd: derived.vpd,
        dewPoint: derived.dewPoint,
      });
    }
  }

  let inserted = 0;
  const chunkSize = 300;
  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    const result = await db
      .insert(readings)
      .values(chunk)
      .onConflictDoNothing({ target: [readings.sensorId, readings.ts] })
      .returning({ id: readings.id });
    inserted += result.length;
  }

  console.log(`Inserted ${inserted} readings (humidity estimated from T for VPD/dew point).`);
  console.log("Open /cabinet/charts as client@example.com to view graphs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
