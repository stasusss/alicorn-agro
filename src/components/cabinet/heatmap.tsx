"use client";

import { useMemo, useState } from "react";

export type HeatmapPoint = {
  id: string;
  name: string;
  x: number;
  y: number;
  currentTemp: number | null;
  dailyAvgTemp: number | null;
};

function tempToColor(temp: number | null, min: number, max: number) {
  if (temp === null || !Number.isFinite(temp)) return "#d2d2d7";
  const t = max === min ? 0.5 : (temp - min) / (max - min);
  const clamped = Math.min(1, Math.max(0, t));
  // soft blue → amber (calm, not neon)
  const hue = 210 - clamped * 175;
  return `hsl(${hue} 55% 52%)`;
}

export function Heatmap({ points }: { points: HeatmapPoint[] }) {
  const [mode, setMode] = useState<"current" | "daily">("current");

  const values = points.map((p) => (mode === "current" ? p.currentTemp : p.dailyAvgTemp));
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 15;
  const max = finite.length ? Math.max(...finite) : 30;

  const legend = useMemo(() => {
    const steps = 5;
    return Array.from({ length: steps }, (_, i) => {
      const v = min + ((max - min) * i) / (steps - 1);
      return { v, color: tempToColor(v, min, max) };
    });
  }, [min, max]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="cab-section-title">Теплова карта</h2>
        <div className="inline-flex rounded-full bg-black/[0.04] p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setMode("current")}
            className={`rounded-full px-3.5 py-1.5 transition ${
              mode === "current"
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            Поточна
          </button>
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={`rounded-full px-3.5 py-1.5 transition ${
              mode === "daily"
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            Середня за добу
          </button>
        </div>
      </div>

      <div className="cab-panel relative aspect-[16/10] w-full overflow-hidden bg-[#fafafa]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.05) 1px, transparent 1px)",
            backgroundSize: "12.5% 12.5%",
          }}
        />
        {points.map((p) => {
          const temp = mode === "current" ? p.currentTemp : p.dailyAvgTemp;
          return (
            <div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <div
                className="flex h-11 w-11 flex-col items-center justify-center rounded-full text-center text-[10px] font-medium text-white ring-2 ring-white/90 sm:h-12 sm:w-12 sm:text-[11px]"
                style={{ backgroundColor: tempToColor(temp, min, max) }}
                title={`${p.name}: ${temp === null ? "—" : `${temp.toFixed(1)} °C`}`}
              >
                <span className="max-w-[2.8rem] truncate leading-tight opacity-90">{p.name}</span>
                <span className="tabular-nums">{temp === null ? "—" : `${temp.toFixed(1)}°`}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#86868b]">
        <span>Шкала</span>
        {legend.map((item) => (
          <span key={item.v} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.v.toFixed(1)}°
          </span>
        ))}
      </div>
    </section>
  );
}
