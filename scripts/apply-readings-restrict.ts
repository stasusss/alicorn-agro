import "dotenv/config";
import { getDb } from "../src/db";
import { applyReadingsSensorRestrict } from "../src/db/restrict-readings";

applyReadingsSensorRestrict(await getDb())
  .then(() => {
    console.log(JSON.stringify({ msg: "readings_sensor_restrict_ok" }));
    process.exit(0);
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ msg: "readings_sensor_restrict_failed", error: message }));
    process.exit(1);
  });