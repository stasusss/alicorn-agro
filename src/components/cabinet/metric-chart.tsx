"use client";

import { metricLabels, metricUnits, type MetricKey } from "@/lib/climate";
import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export type ChartSeriesPoint = { ts: number; value: number };
export type ChartSeries = { id: string; name: string; color: string; points: ChartSeriesPoint[] };

const COLORS = ["#ff375f", "#bf4800", "#0071e3", "#1d1d1f", "#86868b", "#34c759", "#af52de"];

type Props = {
  metric: MetricKey;
  sensors: { id: string; name: string }[];
};

type PeriodPreset = "today" | "24h" | "7d" | "custom";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rangeForPreset(preset: PeriodPreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (preset === "24h") {
    from.setTime(to.getTime() - 24 * 60 * 60_000);
  } else if (preset === "7d") {
    from.setTime(to.getTime() - 7 * 24 * 60 * 60_000);
  }
  return { from: toLocalInput(from), to: toLocalInput(to) };
}

function topDeviatingIds(series: ChartSeries[], limit: number): string[] {
  const withPoints = series.filter((s) => s.points.length > 0);
  if (withPoints.length <= limit) return withPoints.map((s) => s.id);

  const means = withPoints.map((s) => ({
    id: s.id,
    mean: s.points.reduce((a, p) => a + p.value, 0) / s.points.length,
  }));
  const global = means.reduce((a, m) => a + m.mean, 0) / means.length;

  return means
    .map((m) => ({ id: m.id, score: Math.abs(m.mean - global) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.id);
}

export function MetricChart({ metric, sensors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [sensorMode, setSensorMode] = useState<"top3" | "all" | string>("top3");
  const [preset, setPreset] = useState<PeriodPreset>("today");
  const initial = rangeForPreset("today");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [series, setSeries] = useState<ChartSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(next: PeriodPreset) {
    setPreset(next);
    if (next === "custom") return;
    const r = rangeForPreset(next);
    setFrom(r.from);
    setTo(r.to);
  }

  const querySensors = useMemo(() => sensors.map((s) => s.id), [sensors]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          metric,
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
          sensors: querySensors.join(","),
        });
        const res = await fetch(`/api/cabinet/charts?${params}`);
        if (!res.ok) throw new Error("Не вдалося завантажити дані");
        const data = (await res.json()) as {
          series: { sensorId: string; name: string; points: { ts: string; value: number }[] }[];
        };
        if (cancelled) return;
        const all = data.series.map((s, i) => ({
          id: s.sensorId,
          name: s.name,
          color: COLORS[i % COLORS.length],
          points: s.points.map((p) => ({
            ts: new Date(p.ts).getTime() / 1000,
            value: p.value,
          })),
        }));
        setSeries(all);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Помилка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [metric, from, to, querySensors]);

  const visibleSeries = useMemo(() => {
    if (sensorMode === "all") return series;
    if (sensorMode === "top3") {
      const ids = new Set(topDeviatingIds(series, 3));
      return series.filter((s) => ids.has(s.id));
    }
    return series.filter((s) => s.id === sensorMode);
  }, [series, sensorMode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    plotRef.current?.destroy();
    plotRef.current = null;

    if (visibleSeries.length === 0 || visibleSeries.every((s) => s.points.length === 0)) return;

    const tsSet = new Set<number>();
    for (const s of visibleSeries) for (const p of s.points) tsSet.add(p.ts);
    const xs = [...tsSet].sort((a, b) => a - b);

    const data: uPlot.AlignedData = [xs];
    for (const s of visibleSeries) {
      const map = new Map(s.points.map((p) => [p.ts, p.value]));
      data.push(xs.map((t) => map.get(t) ?? null));
    }

    const chartHeight = window.matchMedia("(max-width: 639px)").matches ? 220 : 260;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: chartHeight,
      series: [
        {},
        ...visibleSeries.map((s) => ({
          label: s.name,
          stroke: s.color,
          width: 1.75,
          spanGaps: true,
        })),
      ],
      axes: [
        { stroke: "#86868b", grid: { stroke: "rgba(0,0,0,0.05)" } },
        {
          stroke: "#86868b",
          grid: { stroke: "rgba(0,0,0,0.05)" },
          label: metricUnits[metric],
        },
      ],
      legend: { show: true },
      cursor: { drag: coarse ? { x: false, y: false } : { x: true, y: false } },
    };

    plotRef.current = new uPlot(opts, data, el);

    const ro = new ResizeObserver(() => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: window.matchMedia("(max-width: 639px)").matches ? 220 : 260,
        });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [visibleSeries, metric]);

  const presets: { id: PeriodPreset; label: string }[] = [
    { id: "today", label: "Сьогодні" },
    { id: "24h", label: "24 год" },
    { id: "7d", label: "7 днів" },
    { id: "custom", label: "Інший" },
  ];

  return (
    <section className="cab-panel p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="cab-section-title" style={{ fontSize: "1.1rem" }}>
              {metricLabels[metric]}
            </h3>
            <p className="mt-1 text-[13px] text-[#86868b]">{metricUnits[metric]}</p>
          </div>
          <div className="inline-flex flex-wrap rounded-full bg-black/[0.04] p-0.5 text-[12px]">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-full px-3 py-1.5 transition ${
                  preset === p.id
                    ? "bg-white text-[#1d1d1f] shadow-sm"
                    : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-[12px] text-[#86868b] sm:min-w-[10rem]">
            Датчики
            <select
              className="cab-input"
              value={sensorMode}
              onChange={(e) => setSensorMode(e.target.value)}
            >
              <option value="top3">Топ-3 відхилення</option>
              <option value="all">Усі датчики</option>
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="text-[12px] text-[#86868b]">
                Від
                <input
                  type="datetime-local"
                  className="cab-input"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-[12px] text-[#86868b]">
                До
                <input
                  type="datetime-local"
                  className="cab-input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {sensorMode === "top3" && (
        <p className="mb-3 text-[12px] text-[#86868b]">
          Показано зони з найбільшим відхиленням від середнього. Можна перемкнути на «Усі».
        </p>
      )}
      {loading && <p className="mb-3 text-[13px] text-[#86868b]">Завантаження…</p>}
      {error && <p className="mb-3 text-[13px] text-[#ff3b30]">{error}</p>}
      {!loading && !error && visibleSeries.every((s) => s.points.length === 0) && (
        <p className="mb-3 text-[13px] text-[#86868b]">Немає даних за вибраний період.</p>
      )}
      <div ref={containerRef} className="w-full overflow-x-auto" />
    </section>
  );
}
