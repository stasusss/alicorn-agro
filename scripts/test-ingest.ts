/**
 * Simulates gateway minute-batch + 12h buffer backfill replay.
 *
 * Usage:
 *   GATEWAY_ID=... GATEWAY_API_KEY=... BASE_URL=http://localhost:3000 npx tsx scripts/test-ingest.ts
 */
import "dotenv/config";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const gatewayId = process.env.GATEWAY_ID;
const apiKey = process.env.GATEWAY_API_KEY ?? process.env.SEED_GATEWAY_API_KEY ?? "gw_demo_key_change_me";

if (!gatewayId) {
  console.error("Set GATEWAY_ID (from seed output / DB)");
  process.exit(1);
}

const sensorIds = ["s1", "s2", "s3", "s4", "s5"];

function reading(sensor: string, ts: Date, temperature: number, humidity: number) {
  return {
    sensor_external_id: sensor,
    ts: ts.toISOString(),
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
  };
}

async function post(readings: ReturnType<typeof reading>[]) {
  const res = await fetch(`${baseUrl}/api/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ gateway_id: gatewayId, readings }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(res.status, body);
  return res.ok;
}

async function main() {
  const now = new Date();

  // 1) Current minute batch (4 samples × 5 sensors ≈ last 60s at 15s interval)
  const live = [];
  for (let i = 3; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 15_000);
    for (const s of sensorIds) {
      const base = 20 + sensorIds.indexOf(s) * 0.4;
      live.push(reading(s, ts, base + Math.sin(ts.getMinutes()) * 1.5, 60 + sensorIds.indexOf(s) * 2));
    }
  }
  console.log("Sending live batch…");
  await post(live);

  // 2) Buffer backfill: last 2 hours every 15s (subset to keep test fast), then replay same ts (idempotent)
  const backfill = [];
  for (let minutesAgo = 120; minutesAgo > 0; minutesAgo -= 5) {
    const ts = new Date(now.getTime() - minutesAgo * 60_000);
    for (const s of sensorIds) {
      const base = 18 + sensorIds.indexOf(s) * 0.3;
      backfill.push(reading(s, ts, base + (minutesAgo % 7) * 0.2, 55 + (minutesAgo % 5)));
    }
  }
  console.log(`Sending backfill (${backfill.length} readings)…`);
  await post(backfill);

  console.log("Replaying same backfill (expect inserted: 0)…");
  await post(backfill);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
