import { getDb } from "@/db";
import { alertRules, gateways, organizations, readings, sensors } from "@/db/schema";
import { hashApiKey } from "@/lib/password";

export async function seedGateway(apiKey = "test-gateway-key") {
  const db = await getDb();
  const [org] = await db
    .insert(organizations)
    .values({ name: "Теплиця", latitude: 50.45, longitude: 30.52, timezone: "Europe/Kyiv" })
    .returning();
  const [gateway] = await db
    .insert(gateways)
    .values({ organizationId: org.id, name: "gw", apiKeyHash: hashApiKey(apiKey) })
    .returning();
  const [sensor] = await db
    .insert(sensors)
    .values({
      organizationId: org.id,
      gatewayId: gateway.id,
      externalId: "s1",
      name: "Зона 1",
    })
    .returning();
  return { db, org, gateway, sensor, apiKey };
}

export async function insertReading(
  db: Awaited<ReturnType<typeof getDb>>,
  row: {
    sensorId: string;
    organizationId: string;
    ts: Date;
    temperature: number;
    humidity: number;
    vpd?: number;
    dewPoint?: number;
  },
) {
  await db.insert(readings).values({
    vpd: 1,
    dewPoint: 10,
    ...row,
  });
}

export async function insertAlertRule(
  db: Awaited<ReturnType<typeof getDb>>,
  row: typeof alertRules.$inferInsert,
) {
  const [rule] = await db.insert(alertRules).values(row).returning();
  return rule;
}
