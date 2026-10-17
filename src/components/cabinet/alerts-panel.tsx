"use client";

import { ALERT_TEMPLATES } from "@/lib/cabinet/alert-templates";
import { metricLabels, type MetricKey } from "@/lib/climate";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SensorOption = { id: string; name: string };

type Rule = {
  id: string;
  name: string;
  channel: "telegram" | "email";
  destination: string;
  targetType: "sensor" | "all_avg";
  sensorId: string | null;
  metric: MetricKey;
  operator: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  cooldownMinutes: number;
  enabled: boolean;
};

type EventRow = {
  id: string;
  message: string;
  triggeredAt: string;
  delivered: boolean;
};

const operators = [
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
] as const;

export function AlertsPanel({
  sensors,
  initialRules,
  initialEvents,
}: {
  sensors: SensorOption[];
  initialRules: Rule[];
  initialEvents: EventRow[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [events] = useState(initialEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    channel: "telegram" as "telegram" | "email",
    destination: "",
    targetType: "all_avg" as "sensor" | "all_avg",
    sensorId: sensors[0]?.id ?? "",
    metric: "temperature" as MetricKey,
    operator: "gt" as Rule["operator"],
    threshold: 30,
    cooldownMinutes: 30,
  });

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/cabinet/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sensorId: form.targetType === "sensor" ? form.sensorId : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не вдалося створити сповіщення");
      return;
    }
    const created = (await res.json()) as Rule;
    setRules((prev) => [created, ...prev]);
    setForm((f) => ({ ...f, name: "", destination: "" }));
    router.refresh();
  }

  async function toggleRule(id: string, enabled: boolean) {
    const res = await fetch(`/api/cabinet/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) return;
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/cabinet/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function applyTemplate(templateId: string) {
    const t = ALERT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setForm((f) => ({
      ...f,
      name: t.name,
      metric: t.metric,
      operator: t.operator,
      threshold: t.threshold,
      targetType: t.targetType,
    }));
  }

  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <h2 className="cab-section-title">Шаблони під культуру</h2>
        <p className="text-[13px] text-[#86868b]">
          Натисніть шаблон — поля форми заповняться. Додайте Telegram/email і збережіть.
        </p>
        <div className="flex flex-wrap gap-2">
          {ALERT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className="cab-btn-ghost"
              title={t.hint}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={createRule} className="cab-panel space-y-4 p-6 sm:p-8">
        <h2 className="cab-section-title">Нове сповіщення</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] text-[#86868b]">
            Назва
            <input
              required
              className="cab-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-[13px] text-[#86868b]">
            Канал
            <select
              className="cab-input"
              value={form.channel}
              onChange={(e) =>
                setForm({ ...form, channel: e.target.value as "telegram" | "email" })
              }
            >
              <option value="telegram">Telegram</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label className="text-[13px] text-[#86868b] sm:col-span-2">
            {form.channel === "telegram" ? "Telegram chat ID" : "Email"}
            <input
              required
              className="cab-input"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder={form.channel === "telegram" ? "123456789" : "you@example.com"}
            />
          </label>
          <label className="text-[13px] text-[#86868b]">
            Ціль
            <select
              className="cab-input"
              value={form.targetType}
              onChange={(e) =>
                setForm({ ...form, targetType: e.target.value as "sensor" | "all_avg" })
              }
            >
              <option value="all_avg">Середнє по всіх датчиках</option>
              <option value="sensor">Конкретний датчик</option>
            </select>
          </label>
          {form.targetType === "sensor" && (
            <label className="text-[13px] text-[#86868b]">
              Датчик
              <select
                className="cab-input"
                value={form.sensorId}
                onChange={(e) => setForm({ ...form, sensorId: e.target.value })}
              >
                {sensors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-[13px] text-[#86868b]">
            Метрика
            <select
              className="cab-input"
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value as MetricKey })}
            >
              {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
                <option key={key} value={key}>
                  {metricLabels[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] text-[#86868b]">
            Умова
            <div className="mt-1.5 flex gap-2">
              <select
                className="cab-input w-auto"
                style={{ marginTop: 0 }}
                value={form.operator}
                onChange={(e) =>
                  setForm({ ...form, operator: e.target.value as Rule["operator"] })
                }
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                required
                className="cab-input"
                style={{ marginTop: 0 }}
                value={form.threshold}
                onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              />
            </div>
          </label>
        </div>
        {error && <p className="text-[13px] text-[#ff3b30]">{error}</p>}
        <button type="submit" disabled={saving} className="cab-btn">
          {saving ? "Збереження…" : "Додати сповіщення"}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="cab-section-title">Активні правила</h2>
        {rules.length === 0 && (
          <p className="text-[13px] text-[#86868b]">Поки немає сповіщень.</p>
        )}
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="cab-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-[13px]">
                <p className="font-medium text-[#1d1d1f]">{rule.name}</p>
                <p className="mt-1 text-[#86868b]">
                  {metricLabels[rule.metric]} {rule.operator} {rule.threshold} ·{" "}
                  {rule.targetType === "all_avg"
                    ? "середнє"
                    : sensors.find((s) => s.id === rule.sensorId)?.name ?? "датчик"}{" "}
                  · {rule.channel}: {rule.destination}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id, !rule.enabled)}
                  className="cab-btn-ghost"
                >
                  {rule.enabled ? "Вимкнути" : "Увімкнути"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteRule(rule.id)}
                  className="cab-btn-ghost"
                  style={{ color: "#ff3b30" }}
                >
                  Видалити
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="cab-section-title">Історія спрацювань</h2>
        {events.length === 0 && (
          <p className="text-[13px] text-[#86868b]">Ще не було спрацювань.</p>
        )}
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.id} className="cab-panel px-5 py-4 text-[13px]">
              <p className="text-[#1d1d1f]">{ev.message}</p>
              <p className="mt-1.5 text-[12px] text-[#86868b]">
                {new Date(ev.triggeredAt).toLocaleString("uk-UA")} ·{" "}
                {ev.delivered ? "доставлено" : "не доставлено"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
