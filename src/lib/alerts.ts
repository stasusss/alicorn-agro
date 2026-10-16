import { getDb } from "@/db";
import { alertEvents, alertRules, readings, sensors } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { Resend } from "resend";
import type { MetricKey } from "./climate";
import { metricLabels, metricUnits } from "./climate";

type Operator = "gt" | "lt" | "gte" | "lte";

function compare(value: number, op: Operator, threshold: number) {
  switch (op) {
    case "gt":
      return value > threshold;
    case "lt":
      return value < threshold;
    case "gte":
      return value >= threshold;
    case "lte":
      return value <= threshold;
  }
}

function metricValue(
  row: { temperature: number; humidity: number; vpd: number; dewPoint: number },
  metric: MetricKey,
) {
  switch (metric) {
    case "temperature":
      return row.temperature;
    case "humidity":
      return row.humidity;
    case "vpd":
      return row.vpd;
    case "dew_point":
      return row.dewPoint;
  }
}

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN missing; skip telegram alert");
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM ?? "alerts@alicorn-agro.com";
  if (!apiKey) {
    console.warn("RESEND_API_KEY missing; skip email alert");
    return false;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text });
  return !error;
}

export async function evaluateAlertsForOrganization(organizationId: string) {
  const db = await getDb();
  const rules = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.organizationId, organizationId), eq(alertRules.enabled, true)));

  if (rules.length === 0) return;

  const orgSensors = await db
    .select()
    .from(sensors)
    .where(and(eq(sensors.organizationId, organizationId), eq(sensors.active, true)));

  if (orgSensors.length === 0) return;

  const latestBySensor = new Map<
    string,
    { temperature: number; humidity: number; vpd: number; dewPoint: number; ts: Date }
  >();

  for (const sensor of orgSensors) {
    const [latest] = await db
      .select()
      .from(readings)
      .where(eq(readings.sensorId, sensor.id))
      .orderBy(desc(readings.ts))
      .limit(1);
    if (latest) {
      latestBySensor.set(sensor.id, {
        temperature: latest.temperature,
        humidity: latest.humidity,
        vpd: latest.vpd,
        dewPoint: latest.dewPoint,
        ts: latest.ts,
      });
    }
  }

  const values = [...latestBySensor.values()];
  const avg =
    values.length === 0
      ? null
      : (() => {
          const sum = values.reduce(
            (acc, v) => ({
              temperature: acc.temperature + v.temperature,
              humidity: acc.humidity + v.humidity,
              vpd: acc.vpd + v.vpd,
              dewPoint: acc.dewPoint + v.dewPoint,
            }),
            { temperature: 0, humidity: 0, vpd: 0, dewPoint: 0 },
          );
          const n = values.length;
          return {
            temperature: sum.temperature / n,
            humidity: sum.humidity / n,
            vpd: sum.vpd / n,
            dewPoint: sum.dewPoint / n,
          };
        })();

  for (const rule of rules) {
    let value: number | null = null;
    let scopeLabel = "";

    if (rule.targetType === "all_avg") {
      if (!avg) continue;
      value = metricValue(avg, rule.metric as MetricKey);
      scopeLabel = "середнє по всіх датчиках";
    } else if (rule.sensorId) {
      const reading = latestBySensor.get(rule.sensorId);
      if (!reading) continue;
      value = metricValue(reading, rule.metric as MetricKey);
      const sensor = orgSensors.find((s) => s.id === rule.sensorId);
      scopeLabel = sensor?.name ?? "датчик";
    }

    if (value === null) continue;
    if (!compare(value, rule.operator, rule.threshold)) continue;

    const since = new Date(Date.now() - rule.cooldownMinutes * 60_000);
    const [recent] = await db
      .select()
      .from(alertEvents)
      .where(and(eq(alertEvents.alertRuleId, rule.id), gte(alertEvents.triggeredAt, since)))
      .limit(1);

    if (recent) continue;

    const unit = metricUnits[rule.metric as MetricKey];
    const label = metricLabels[rule.metric as MetricKey];
    const message = `Алерт «${rule.name}»: ${label} (${scopeLabel}) = ${value.toFixed(2)} ${unit} (поріг ${rule.operator} ${rule.threshold})`;

    let delivered = false;
    if (rule.channel === "telegram") {
      delivered = await sendTelegram(rule.destination, message);
    } else {
      delivered = await sendEmail(rule.destination, `Alicorn Agro: ${rule.name}`, message);
    }

    await db.insert(alertEvents).values({
      alertRuleId: rule.id,
      organizationId,
      value,
      message,
      delivered,
    });
  }
}
