/**
 * Inserts a day of synthetic readings for local UI demos.
 */
import "dotenv/config";
import { getDb } from "../src/db";
import { readings, sensors } from "../src/db/schema";
import { computeDerivedMetrics } from "../src/lib/climate";

async function main() {
  const db = await getDb();
  const allSensors = await db.select().from(sensors);
  if (allSensors.length === 0) {
    throw new Error("No sensors — run npm run db:seed first");
  }

  const now = Date.now();
  const rows = [];
  for (let minutesAgo = 24 * 60; minutesAgo >= 0; minutesAgo -= 5) {
    const ts = new Date(now - minutesAgo * 60_000);
    for (const sensor of allSensors) {
      const idx = allSensors.indexOf(sensor);
      const hour = ts.getHours() + ts.getMinutes() / 60;
      const diurnal = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 4;
      const temperature = 18 + idx * 0.5 + diurnal;
      const humidity = 70 - diurnal * 2 + idx;
      const derived = computeDerivedMetrics(temperature, humidity);
      rows.push({
        sensorId: sensor.id,
        organizationId: sensor.organizationId,
        ts,
        temperature: Math.round(temperature * 10) / 10,
        humidity: Math.round(humidity * 10) / 10,
        vpd: derived.vpd,
        dewPoint: derived.dewPoint,
      });
    }
  }

  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const result = await db
      .insert(readings)
      .values(chunk)
      .onConflictDoNothing({ target: [readings.sensorId, readings.ts] })
      .returning({ id: readings.id });
    inserted += result.length;
  }

  console.log(`Inserted ${inserted} / ${rows.length} demo readings`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
