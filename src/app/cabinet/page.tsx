import { Heatmap } from "@/components/cabinet/heatmap";
import { QuickReportButton } from "@/components/cabinet/quick-report-button";
import { auth } from "@/lib/auth";
import {
  evaluateOverviewStatus,
  relativeTimeUk,
} from "@/lib/cabinet/climate-status";
import {
  getDailyAvgTemperatureBySensor,
  getDataOutages,
  getDayOverDayTempCompare,
  getFreshestReadingTs,
  getGatewayStatus,
  getLatestReadingsBySensor,
  getRecentIngestLogs,
  getTemperatureAggregates,
} from "@/lib/cabinet/queries";
import { parseIngestSummary } from "@/lib/ingest-log";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Огляд",
};

function fmt(n: number | null, digits = 1) {
  if (n === null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function shortWhen(d: Date) {
  return d.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

export default async function CabinetOverviewPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;
  const now = new Date();
  const outageFrom = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  const [latest, aggregates, dailyBySensor, gateway, freshestTs, dayCompare, outages, ingestLog] =
    await Promise.all([
      getLatestReadingsBySensor(orgId),
      getTemperatureAggregates(orgId),
      getDailyAvgTemperatureBySensor(orgId),
      getGatewayStatus(orgId),
      getFreshestReadingTs(orgId),
      getDayOverDayTempCompare(orgId),
      getDataOutages(orgId, outageFrom, now, 20),
      getRecentIngestLogs(orgId),
    ]);

  const status = evaluateOverviewStatus(
    latest.map(({ sensor, reading }) => ({
      sensorId: sensor.id,
      name: sensor.name,
      temperature: reading?.temperature ?? null,
      humidity: reading?.humidity ?? null,
      vpd: reading?.vpd ?? null,
      ts: reading?.ts ?? null,
    })),
    { gatewayLastSeen: gateway.lastSeenAt, now },
  );

  const issueById = new Map(status.problemZones.map((z) => [z.sensorId, z.severity]));

  const heatmapPoints = latest.map(({ sensor, reading }) => ({
    id: sensor.id,
    name: sensor.name,
    x: sensor.positionX,
    y: sensor.positionY,
    currentTemp: reading?.temperature ?? null,
    dailyAvgTemp: dailyBySensor.get(sensor.id) ?? null,
    issueSeverity: issueById.get(sensor.id) ?? null,
  }));

  const statusStyles = {
    ok: "border-[#34c759]/25 bg-[#34c759]/10",
    attention: "border-[#ff9f0a]/30 bg-[#ff9f0a]/10",
    critical: "border-[#ff3b30]/30 bg-[#ff3b30]/10",
    offline: "border-[#86868b]/30 bg-[#86868b]/10",
    empty: "border-black/10 bg-white",
  } as const;

  const statusDot = {
    ok: "bg-[#34c759]",
    attention: "bg-[#ff9f0a]",
    critical: "bg-[#ff3b30]",
    offline: "bg-[#86868b]",
    empty: "bg-[#d2d2d7]",
  } as const;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="cab-title">Огляд теплиці</h1>
          <p className="cab-subtitle">Що важливо зараз — стан, ключові цифри, карта зон.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickReportButton />
          <Link href="/cabinet/export" className="cab-btn-ghost">
            Звіти
          </Link>
        </div>
      </header>

      {/* 1 + 4 + 9: status, gateway freshness, hero metrics */}
      <div
        className={`cab-panel border px-5 py-5 sm:px-6 ${statusStyles[status.level]}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[status.level]}`}
            />
            <div>
              <p className="font-display text-xl font-semibold tracking-tight text-[#1d1d1f]">
                {status.title}
              </p>
              <p className="mt-1 text-[14px] text-[#1d1d1f]/75">{status.detail}</p>
            </div>
          </div>
          <div className="text-[12px] text-[#86868b] sm:text-right">
            <p>
              Дані:{" "}
              <span className="font-medium text-[#1d1d1f]">
                {relativeTimeUk(freshestTs, now)}
              </span>
            </p>
            <p className="mt-0.5">
              Шлюз:{" "}
              <span className="font-medium text-[#1d1d1f]">
                {gateway.lastSeenAt
                  ? relativeTimeUk(gateway.lastSeenAt, now)
                  : "ще не виходив"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="cab-section-title">Надходження зі шлюзу</h2>
        {ingestLog.length === 0 ? (
          <p className="text-[13px] text-[#86868b]">Пакетів від приймача ще не було.</p>
        ) : (
          <ul className="cab-panel divide-y divide-black/[0.05]">
            {ingestLog.map((entry) => {
              const summary = parseIngestSummary(entry.summary);
              const sensors = summary.sensors.map((sensor) => `${sensor.id} × ${sensor.count}`).join(", ");
              const range =
                entry.tsFrom && entry.tsTo
                  ? `${shortWhen(entry.tsFrom)} — ${shortWhen(entry.tsTo)}`
                  : null;
              return (
                <li key={entry.id} className="px-4 py-3 text-[13px]">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="font-medium text-[#1d1d1f]">{shortWhen(entry.receivedAt)}</span>
                    <span className="text-[#86868b]">
                      прийнято {entry.received}, нових {entry.inserted}
                      {entry.skippedUnknown > 0 ? `, невідомих ${entry.skippedUnknown}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[#86868b]">
                    {sensors || "без відомих датчиків"}
                    {range ? ` · виміри ${range}` : ""}
                  </p>
                  {summary.unknownSensors.length > 0 && (
                    <p className="mt-1 text-[#ff9f0a]">
                      Невідомі id: {summary.unknownSensors.join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="cab-panel px-5 py-7 sm:px-7">
          <p className="text-[12px] font-medium tracking-wide text-[#86868b]">
            Середня температура за 5 хв
          </p>
          <p className="mt-2 font-display text-[3rem] font-semibold leading-none tracking-tight text-[#1d1d1f] sm:text-[3.5rem]">
            {fmt(status.avgTemp)}
            <span className="ml-1 text-[1.4rem] font-medium text-[#86868b]">°C</span>
          </p>
          {dayCompare?.delta !== null && dayCompare?.delta !== undefined && (
            <p className="mt-3 text-[13px] text-[#86868b]">
              vs учора о цій годині:{" "}
              <span
                className={
                  dayCompare.delta > 0.15
                    ? "font-medium text-[#ff9f0a]"
                    : dayCompare.delta < -0.15
                      ? "font-medium text-[#0071e3]"
                      : "font-medium text-[#1d1d1f]"
                }
              >
                {dayCompare.delta > 0 ? "+" : ""}
                {dayCompare.delta.toFixed(1)} °C
              </span>
            </p>
          )}
        </div>
        <div className="cab-panel px-5 py-7 sm:px-7">
          <p className="text-[12px] font-medium tracking-wide text-[#86868b]">
            Найпроблемніша зона
          </p>
          {status.worstZone ? (
            <>
              <p className="mt-2 font-display text-[2rem] font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.4rem]">
                {status.worstZone.name}
              </p>
              <p className="mt-2 text-[13px] text-[#86868b]">
                {status.worstZone.reasons.join("; ")}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-[2rem] font-semibold tracking-tight text-[#34c759] sm:text-[2.4rem]">
                Немає
              </p>
              <p className="mt-2 text-[13px] text-[#86868b]">Усі зони в комфорті</p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Середньодобова" value={`${fmt(aggregates.dailyAvg)}°`} unit="C" />
        <StatCard
          label="Середньоденна"
          value={`${fmt(aggregates.dayAvg)}°`}
          unit="C"
          hint="схід → захід"
        />
        <StatCard
          label="Середньонічна"
          value={`${fmt(aggregates.nightAvg)}°`}
          unit="C"
          hint="захід → схід"
        />
      </div>

      {/* 2: problem zones on map */}
      <Heatmap points={heatmapPoints} latestTs={freshestTs?.toISOString() ?? null} />

      {status.problemZones.length > 0 && (
        <section className="space-y-3">
          <h2 className="cab-section-title">Проблемні зони</h2>
          <ul className="space-y-2">
            {status.problemZones.map((z) => (
              <li
                key={z.sensorId}
                className={`cab-panel flex items-start gap-3 px-4 py-3 text-[13px] ${
                  z.severity === "critical" ? "border-[#ff3b30]/25" : "border-[#ff9f0a]/25"
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    z.severity === "critical" ? "bg-[#ff3b30]" : "bg-[#ff9f0a]"
                  }`}
                />
                <div>
                  <p className="font-medium text-[#1d1d1f]">{z.name}</p>
                  <p className="text-[#86868b]">{z.reasons.join("; ")}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 12: outages */}
      <section className="space-y-3">
        <h2 className="cab-section-title">Пропуски даних (7 днів)</h2>
        {outages.length === 0 ? (
          <p className="text-[13px] text-[#86868b]">
            Значних розривів (&gt;20 хв) не виявлено.
          </p>
        ) : (
          <ul className="cab-panel divide-y divide-black/[0.05]">
            {outages.map((o, i) => (
              <li key={i} className="flex flex-col gap-1 px-4 py-3 text-[13px] sm:flex-row sm:items-baseline sm:justify-between">
                <span className="text-[#1d1d1f]">
                  {shortWhen(o.from)} — {shortWhen(o.to)}
                </span>
                <span className="text-[#86868b]">{o.minutes} хв без даних</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="cab-section-title">Середнє за 5 хвилин</h2>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Згладжене вікно по кожному датчику. Якщо за ці 5 хвилин прийшло менше вимірів,
            рахуємо по тих, що є.
          </p>
        </div>
        <ul className="space-y-2 sm:hidden">
          {latest.map(({ sensor, reading }) => {
            const issue = issueById.get(sensor.id);
            return (
              <li
                key={sensor.id}
                className={`cab-panel px-4 py-3.5 ${
                  issue === "critical"
                    ? "border-[#ff3b30]/25"
                    : issue === "warn"
                      ? "border-[#ff9f0a]/25"
                      : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-[#1d1d1f]">
                    {sensor.name}
                    {issue && (
                      <span className="ml-2 text-[11px] font-normal text-[#ff9f0a]">увага</span>
                    )}
                  </p>
                  <p className="font-display text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums">
                    {fmt(reading?.temperature ?? null)}
                    <span className="ml-0.5 text-[0.9rem] font-medium text-[#86868b]">°C</span>
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[#86868b]">RH %</dt>
                    <dd className="mt-0.5 tabular-nums text-[#1d1d1f]">
                      {fmt(reading?.humidity ?? null)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#86868b]">VPD</dt>
                    <dd className="mt-0.5 tabular-nums text-[#1d1d1f]">
                      {fmt(reading?.vpd ?? null, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#86868b]">Dew</dt>
                    <dd className="mt-0.5 tabular-nums text-[#1d1d1f]">
                      {fmt(reading?.dewPoint ?? null)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[12px] text-[#86868b]">
                  {reading?.ts ? shortWhen(new Date(reading.ts)) : "немає даних"}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="cab-panel hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#86868b]">
                <th className="px-5 py-3.5 font-medium">Датчик</th>
                <th className="px-5 py-3.5 font-medium">T °C</th>
                <th className="px-5 py-3.5 font-medium">RH %</th>
                <th className="px-5 py-3.5 font-medium">VPD</th>
                <th className="px-5 py-3.5 font-medium">Dew</th>
                <th className="px-5 py-3.5 font-medium">Оновлено</th>
              </tr>
            </thead>
            <tbody>
              {latest.map(({ sensor, reading }) => {
                const issue = issueById.get(sensor.id);
                return (
                  <tr
                    key={sensor.id}
                    className={`border-b border-black/[0.04] last:border-0 ${
                      issue === "critical"
                        ? "bg-[#ff3b30]/06"
                        : issue === "warn"
                          ? "bg-[#ff9f0a]/06"
                          : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-medium text-[#1d1d1f]">
                      {sensor.name}
                      {issue && (
                        <span className="ml-2 text-[11px] font-normal text-[#ff9f0a]">
                          увага
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">
                      {fmt(reading?.temperature ?? null)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[#86868b]">
                      {fmt(reading?.humidity ?? null)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[#86868b]">
                      {fmt(reading?.vpd ?? null, 2)}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-[#86868b]">
                      {fmt(reading?.dewPoint ?? null)}
                    </td>
                    <td className="px-5 py-3.5 text-[#86868b]">
                      {reading?.ts
                        ? new Date(reading.ts).toLocaleString("uk-UA", {
                            timeZone: "Europe/Kyiv",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="cab-panel px-5 py-6 sm:px-6">
      <p className="text-[12px] font-medium tracking-wide text-[#86868b]">{label}</p>
      <p className="mt-1 font-display text-[2rem] font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.25rem]">
        {value}
        {unit && <span className="ml-0.5 text-[1.1rem] font-medium text-[#86868b]">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[12px] text-[#86868b]">{hint}</p>}
    </div>
  );
}
