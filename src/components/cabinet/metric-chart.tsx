"use client";

import { metricLabels, metricUnits, type MetricKey } from "@/lib/climate";
import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export type ChartSeriesPoint = { ts: number; value: number };
export type ChartSeries = { id: string; name: string; color: string; points: ChartSeriesPoint[] };

const COLORS = ["#1d1d1f", "#0071e3", "#86868b", "#bf4800", "#34c759", "#af52de", "#ff375f"];

type Props = {
  metric: MetricKey;
  sensors: { id: string; name: string }[];
};

export function MetricChart({ metric, sensors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [sensorMode, setSensorMode] = useState<string>("all");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [series, setSeries] = useState<ChartSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const querySensors = useMemo(() => {
    if (sensorMode === "all") return sensors.map((s) => s.id);
    return [sensorMode];
  }, [sensorMode, sensors]);

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
        setSeries(
          data.series.map((s, i) => ({
            id: s.sensorId,
            name: s.name,
            color: COLORS[i % COLORS.length],
            points: s.points.map((p) => ({ ts: new Date(p.ts).getTime() / 1000, value: p.value })),
          })),
        );
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    plotRef.current?.destroy();
    plotRef.current = null;

    if (series.length === 0 || series.every((s) => s.points.length === 0)) return;

    // Align timestamps — use union of all ts, forward-fill with nulls
    const tsSet = new Set<number>();
    for (const s of series) for (const p of s.points) tsSet.add(p.ts);
    const xs = [...tsSet].sort((a, b) => a - b);

    const data: uPlot.AlignedData = [xs];
    for (const s of series) {
      const map = new Map(s.points.map((p) => [p.ts, p.value]));
      data.push(xs.map((t) => map.get(t) ?? null));
    }

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 260,
      series: [
        {},
        ...series.map((s) => ({
          label: s.name,
          stroke: s.color,
          width: 1.75,
          spanGaps: true,
        })),
      ],
      axes: [
        {
          stroke: "#86868b",
          grid: { stroke: "rgba(0,0,0,0.05)" },
        },
        {
          stroke: "#86868b",
          grid: { stroke: "rgba(0,0,0,0.05)" },
          label: metricUnits[metric],
        },
      ],
      legend: { show: true },
      cursor: { drag: { x: true, y: false } },
    };

    plotRef.current = new uPlot(opts, data, el);

    const ro = new ResizeObserver(() => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: 260,
        });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [series, metric]);

  return (
    <section className="cab-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="cab-section-title" style={{ fontSize: "1.1rem" }}>
            {metricLabels[metric]}
          </h3>
          <p className="mt-1 text-[13px] text-[#86868b]">{metricUnits[metric]}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-[12px] text-[#86868b]">
            Датчик
            <select
              className="cab-input"
              value={sensorMode}
              onChange={(e) => setSensorMode(e.target.value)}
            >
              <option value="all">Усі датчики</option>
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
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
        </div>
      </div>
      {loading && <p className="mb-3 text-[13px] text-[#86868b]">Завантаження…</p>}
      {error && <p className="mb-3 text-[13px] text-[#ff3b30]">{error}</p>}
      {!loading && !error && series.every((s) => s.points.length === 0) && (
        <p className="mb-3 text-[13px] text-[#86868b]">Немає даних за вибраний період.</p>
      )}
      <div ref={containerRef} className="w-full overflow-x-auto" />
    </section>
  );
}
