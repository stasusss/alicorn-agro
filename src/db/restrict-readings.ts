import { sql } from "drizzle-orm";

type Executable = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

/** Readings outlive a sensor row. Deactivate the sensor instead of deleting it. */
export async function applyReadingsSensorRestrict(db: Executable) {
  await db.execute(sql`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'readings'::regclass
          AND c.contype = 'f'
          AND a.attname = 'sensor_id'
      LOOP
        EXECUTE format('ALTER TABLE readings DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $$;
  `);
  await db.execute(sql`
    ALTER TABLE readings
      ADD CONSTRAINT readings_sensor_id_fkey
      FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE RESTRICT;
  `);
}
