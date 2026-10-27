import { getDb } from "@/db";
import { alertEvents, alertRules, sensors } from "@/db/schema";
import { getSmoothedLatestReading } from "@/lib/cabinet/queries";
import { logger } from "@/lib/log";
import { site } from "@/lib/site";
import { and, eq, gte } from "drizzle-orm";
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
    logger.warn({ msg: "alert_telegram_skipped", reason: "TELEGRAM_BOT_TOKEN missing" });
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });
  if (!res.ok) {
    logger.error({ msg: "alert_telegram_failed", status: res.status });
  }
  return res.ok;
}

function cabinetUrl() {
  return (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://alicorn-agro-rho.vercel.app").replace(
    /\/$/,
    "",
  );
}

async function sendEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM ?? "alerts@alicorn-agro.com";
  if (!apiKey) {
    logger.warn({ msg: "alert_email_skipped", reason: "RESEND_API_KEY missing" });
    return false;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text });
  if (error) {
    logger.error({ msg: "alert_email_failed", error: error.message });
    return false;
  }
  return true;
}

export async function deliverOperatorNotice(input: {
  subject: string;
  text: string;
  telegramText: string;
}) {
  const chatId = (process.env.CHAT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID)?.trim();
  const telegram = chatId ? await sendTelegram(chatId, input.telegramText) : false;
  if (!chatId) {
    logger.warn({ msg: "chat_telegram_skipped", reason: "CHAT_TELEGRAM_CHAT_ID missing" });
  }
  const to = process.env.OPERATOR_EMAIL?.trim() || site.notifyEmail;
  const email = await sendEmail(to, input.subject, input.text);
  return { telegram, email };
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
    const latest = await getSmoothedLatestReading(sensor.id);
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
    const link = `${cabinetUrl()}/cabinet`;
    const plain = `Сповіщення «${rule.name}»: ${label} (${scopeLabel}) = ${value.toFixed(2)} ${unit} (поріг ${rule.operator} ${rule.threshold})`;
    const telegram = [
      `🔔 <b>Alicorn Agro · сповіщення</b>`,
      `<b>${escapeHtml(rule.name)}</b>`,
      `${escapeHtml(label)} (${escapeHtml(scopeLabel)}): <b>${value.toFixed(2)} ${escapeHtml(unit)}</b>`,
      `Поріг: ${escapeHtml(rule.operator)} ${rule.threshold}`,
      ``,
      `👉 <a href="${link}">Відкрити кабінет / карту</a>`,
    ].join("\n");
    const emailBody = `${plain}\n\nКабінет: ${link}`;

    let delivered = false;
    try {
      if (rule.channel === "telegram") {
        delivered = await sendTelegram(rule.destination, telegram);
      } else {
        delivered = await sendEmail(
          rule.destination,
          `Alicorn Agro · сповіщення: ${rule.name}`,
          emailBody,
        );
      }
    } catch (err) {
      logger.error({
        msg: "alert_delivery_failed",
        organizationId,
        ruleId: rule.id,
        channel: rule.channel,
        err,
      });
      delivered = false;
    }

    await db.insert(alertEvents).values({
      alertRuleId: rule.id,
      organizationId,
      value,
      message: plain,
      delivered,
    });
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
