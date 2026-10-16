import { Heatmap } from "@/components/cabinet/heatmap";
import { auth } from "@/lib/auth";
import {
  getDailyAvgTemperatureBySensor,
  getLatestReadingsBySensor,
  getTemperatureAggregates,
} from "@/lib/cabinet/queries";
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

export default async function CabinetOverviewPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;
  const [latest, aggregates, dailyBySensor] = await Promise.all([
    getLatestReadingsBySensor(orgId),
    getTemperatureAggregates(orgId),
    getDailyAvgTemperatureBySensor(orgId),
  ]);

  const heatmapPoints = latest.map(({ sensor, reading }) => ({
    id: sensor.id,
    name: sensor.name,
    x: sensor.positionX,
    y: sensor.positionY,
    currentTemp: reading?.temperature ?? null,
    dailyAvgTemp: dailyBySensor.get(sensor.id) ?? null,
  }));

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="cab-title">Огляд теплиці</h1>
          <p className="cab-subtitle">
            Поточні показники та середні температури по всіх датчиках.
          </p>
        </div>
        <Link href="/cabinet/export" className="cab-btn shrink-0 self-start sm:self-auto">
          Замовити звіт
        </Link>
      </header>

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

      <Heatmap points={heatmapPoints} />

      <section className="space-y-4">
        <h2 className="cab-section-title">Поточні значення</h2>
        <div className="cab-panel overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#86868b]">
                <th className="px-5 py-3.5 font-medium">Датчик</th>
                <th className="px-5 py-3.5 font-medium">T °C</th>
                <th className="px-5 py-3.5 font-medium">RH %</th>
                <th className="px-5 py-3.5 font-medium">VPD</th>
                <th className="px-5 py-3.5 font-medium">Dew °C</th>
                <th className="px-5 py-3.5 font-medium">Оновлено</th>
              </tr>
            </thead>
            <tbody>
              {latest.map(({ sensor, reading }) => (
                <tr
                  key={sensor.id}
                  className="border-b border-black/[0.04] last:border-0"
                >
                  <td className="px-5 py-3.5 font-medium text-[#1d1d1f]">{sensor.name}</td>
                  <td className="px-5 py-3.5 tabular-nums">{fmt(reading?.temperature ?? null)}</td>
                  <td className="px-5 py-3.5 tabular-nums">{fmt(reading?.humidity ?? null)}</td>
                  <td className="px-5 py-3.5 tabular-nums">{fmt(reading?.vpd ?? null, 2)}</td>
                  <td className="px-5 py-3.5 tabular-nums">{fmt(reading?.dewPoint ?? null)}</td>
                  <td className="px-5 py-3.5 text-[#86868b]">
                    {reading?.ts
                      ? new Date(reading.ts).toLocaleString("uk-UA", {
                          timeZone: "Europe/Kyiv",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
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
      <p className="mt-2 font-display text-[2rem] font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.25rem]">
        {value}
        {unit && <span className="ml-0.5 text-[1.1rem] font-medium text-[#86868b]">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[12px] text-[#86868b]">{hint}</p>}
    </div>
  );
}
