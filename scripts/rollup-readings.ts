import { getDb } from "../src/db";
import { rollupOldReadings } from "../src/lib/readings-rollup";

const db = await getDb();
const result = await rollupOldReadings(db);
console.log(JSON.stringify(result));
