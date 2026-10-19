import { alertEvents, sensors } from "@/db/schema";
import { evaluateAlertsForOrganization } from "@/lib/alerts";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertAlertRule, insertReading, seedGateway } from "./helpers/seed";

const sendEmail = vi.hoisted(() => vi.fn(async () => ({ error: null as { message: string } | null })));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ error: null });
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.RESEND_API_KEY;
});

async function withReading(temperature: number, humidity = 60) {
  const seeded = await seedGateway();
  await insertReading(seeded.db, {
    sensorId: seeded.sensor.id,
    organizationId: seeded.org.id,
    ts: new Date(),
    temperature,
    humidity,
  });
  return seeded;
}

describe("alert evaluation", () => {
  it("sends once, then respects cooldown", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response("ok", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { db, org, sensor } = await withReading(30);
    await insertAlertRule(db, {
      organizationId: org.id,
      name: "Жарко",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: sensor.id,
      metric: "temperature",
      operator: "gt",
      threshold: 25,
    });

    await evaluateAlertsForOrganization(org.id);
    await evaluateAlertsForOrganization(org.id);

    const events = await db.select().from(alertEvents).where(eq(alertEvents.organizationId, org.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.delivered).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = String(fetchMock.mock.calls[0]?.[1] && (fetchMock.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).not.toContain("test-token");
  });

  it("ignores a disabled rule", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const { db, org, sensor } = await withReading(30);
    await insertAlertRule(db, {
      organizationId: org.id,
      name: "Вимкнено",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: sensor.id,
      metric: "temperature",
      operator: "gt",
      threshold: 25,
      enabled: false,
    });
    await evaluateAlertsForOrganization(org.id);
    expect(await db.select().from(alertEvents).where(eq(alertEvents.organizationId, org.id))).toHaveLength(0);
  });

  it("compares one sensor and the house average separately", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const seeded = await seedGateway();
    const cold = seeded.sensor;
    const [hot] = await seeded.db
      .insert(sensors)
      .values({
        organizationId: seeded.org.id,
        gatewayId: seeded.gateway.id,
        externalId: "s2",
        name: "Гаряча",
      })
      .returning();
    const now = new Date();
    await insertReading(seeded.db, {
      sensorId: cold.id,
      organizationId: seeded.org.id,
      ts: now,
      temperature: 10,
      humidity: 60,
    });
    await insertReading(seeded.db, {
      sensorId: hot.id,
      organizationId: seeded.org.id,
      ts: now,
      temperature: 30,
      humidity: 60,
    });
    await insertAlertRule(seeded.db, {
      organizationId: seeded.org.id,
      name: "Середнє",
      channel: "telegram",
      destination: "100",
      targetType: "all_avg",
      metric: "temperature",
      operator: "gt",
      threshold: 19,
    });
    await insertAlertRule(seeded.db, {
      organizationId: seeded.org.id,
      name: "Холод",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: cold.id,
      metric: "temperature",
      operator: "lt",
      threshold: 12,
    });
    await insertAlertRule(seeded.db, {
      organizationId: seeded.org.id,
      name: "Не спрацює",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: hot.id,
      metric: "temperature",
      operator: "gt",
      threshold: 100,
    });

    await evaluateAlertsForOrganization(seeded.org.id);
    const events = await seeded.db.select().from(alertEvents).where(eq(alertEvents.organizationId, seeded.org.id));
    expect(events.map((event) => event.message).sort()).toEqual(
      expect.arrayContaining([expect.stringContaining("Середнє"), expect.stringContaining("Холод")]),
    );
    expect(events).toHaveLength(2);
  });

  it("records a failed telegram or email delivery", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const telegram = await withReading(30);
    await insertAlertRule(telegram.db, {
      organizationId: telegram.org.id,
      name: "Жарко",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: telegram.sensor.id,
      metric: "temperature",
      operator: "gt",
      threshold: 25,
    });
    await evaluateAlertsForOrganization(telegram.org.id);
    const [telegramEvent] = await telegram.db
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.organizationId, telegram.org.id));
    expect(telegramEvent?.delivered).toBe(false);

    process.env.RESEND_API_KEY = "re_test";
    sendEmail.mockResolvedValue({ error: { message: "mailbox missing" } });
    const email = await withReading(30);
    await insertAlertRule(email.db, {
      organizationId: email.org.id,
      name: "Лист",
      channel: "email",
      destination: "grower@example.com",
      targetType: "sensor",
      sensorId: email.sensor.id,
      metric: "temperature",
      operator: "gt",
      threshold: 25,
    });
    await evaluateAlertsForOrganization(email.org.id);
    const [emailEvent] = await email.db.select().from(alertEvents).where(eq(alertEvents.organizationId, email.org.id));
    expect(emailEvent?.delivered).toBe(false);
    expect(JSON.stringify(sendEmail.mock.calls)).toContain("grower@example.com");
  });

  it("keeps the event when the network call throws", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    const { db, org, sensor } = await withReading(30);
    await insertAlertRule(db, {
      organizationId: org.id,
      name: "Жарко",
      channel: "telegram",
      destination: "100",
      targetType: "sensor",
      sensorId: sensor.id,
      metric: "temperature",
      operator: "gt",
      threshold: 25,
    });
    await evaluateAlertsForOrganization(org.id);
    const [event] = await db.select().from(alertEvents).where(eq(alertEvents.organizationId, org.id));
    expect(event?.delivered).toBe(false);
  });
});
