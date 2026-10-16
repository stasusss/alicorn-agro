import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { gateways, organizations, sensors, users } from "../src/db/schema";
import { hashApiKey, hashPassword } from "../src/lib/password";

async function main() {
  const db = await getDb();

  const email = (process.env.SEED_USER_EMAIL ?? "client@example.com").toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "changeme";
  const gatewayKey = process.env.SEED_GATEWAY_API_KEY ?? "gw_demo_key_change_me";

  const [existingOrg] = await db.select().from(organizations).limit(1);
  let orgId = existingOrg?.id;

  if (!orgId) {
    const [org] = await db
      .insert(organizations)
      .values({
        name: "Тестова теплиця",
        // Near Kyiv — used for sunrise/sunset day/night averages
        latitude: 50.4501,
        longitude: 30.5234,
        timezone: "Europe/Kyiv",
      })
      .returning();
    orgId = org.id;
    console.log("Created organization", orgId);
  } else {
    console.log("Using existing organization", orgId);
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!existingUser) {
    await db.insert(users).values({
      organizationId: orgId,
      email,
      name: "Клієнт",
      passwordHash: await hashPassword(password),
    });
    console.log("Created user", email);
  } else {
    console.log("User already exists", email);
  }

  const [existingGw] = await db.select().from(gateways).limit(1);
  let gatewayId = existingGw?.id;

  if (!gatewayId) {
    const [gw] = await db
      .insert(gateways)
      .values({
        organizationId: orgId,
        name: "Шлюз №1",
        apiKeyHash: hashApiKey(gatewayKey),
      })
      .returning();
    gatewayId = gw.id;
    console.log("Created gateway", gatewayId);
    console.log("Gateway API key (save it):", gatewayKey);
  } else {
    console.log("Using existing gateway", gatewayId);
  }

  const existingSensors = await db.select().from(sensors).where(eq(sensors.gatewayId, gatewayId));
  if (existingSensors.length === 0) {
    const layout = [
      { externalId: "s1", name: "Зона A1", positionX: 0.15, positionY: 0.2 },
      { externalId: "s2", name: "Зона A2", positionX: 0.5, positionY: 0.2 },
      { externalId: "s3", name: "Зона B1", positionX: 0.85, positionY: 0.35 },
      { externalId: "s4", name: "Зона B2", positionX: 0.3, positionY: 0.7 },
      { externalId: "s5", name: "Зона C1", positionX: 0.7, positionY: 0.75 },
    ];

    await db.insert(sensors).values(
      layout.map((s) => ({
        organizationId: orgId!,
        gatewayId: gatewayId!,
        ...s,
      })),
    );
    console.log("Created 5 sensors");
  } else {
    console.log(`Gateway already has ${existingSensors.length} sensors`);
  }

  console.log("Seed complete.");
  console.log({ email, password, gatewayKey, gatewayId });
  console.log("Set GATEWAY_ID in .env for npm run test:ingest");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
