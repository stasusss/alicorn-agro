-- Stop a sensor delete from erasing client readings.
-- Idempotent. On Neon, once: npm run db:restrict-readings
-- Local PGlite applies the same statements when the app opens the database.

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

ALTER TABLE readings
  ADD CONSTRAINT readings_sensor_id_fkey
  FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE RESTRICT;
