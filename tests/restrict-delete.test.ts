import { readings, sensors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertReading, seedGateway } from "./helpers/seed";

describe("readings survive a sensor delete", () => {
  it("rejects deleting a sensor that still has measurements and allows deactivation", async () => {
    const { db, org, sensor } = await seedGateway();
    await insertReading(db, {
      sensorId: sensor.id,
      organizationId: org.id,
      ts: new Date("2026-10-19T12:00:00.000Z"),
      temperature: 22,
      humidity: 60,
    });

    await expect(db.delete(sensors).where(eq(sensors.id, sensor.id))).rejects.toThrow();
    expect(await db.select().from(readings)).toHaveLength(1);

    await db.update(sensors).set({ active: false }).where(eq(sensors.id, sensor.id));
    const [row] = await db.select().from(sensors).where(eq(sensors.id, sensor.id));
    expect(row?.active).toBe(false);
    expect(await db.select().from(readings)).toHaveLength(1);
  });
});
