import { getDb } from "../src/db";
import { rollupOldReadings } from "../src/lib/readings-rollup";

async function main() {
  const db = await getDb();
  const result = await rollupOldReadings(db);
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "rollup failed");
  process.exit(1);
});
