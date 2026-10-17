"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type HeatmapPoint = {
  id: string;
  name: string;
  x: number;
  y: number;
  currentTemp: number | null;
  dailyAvgTemp: number | null;
  /** Problem highlight from status engine */
  issueSeverity?: "warn" | "critical" | null;
};

/** Soft thermal palette: cool → warm (sRGB stops). */
const PALETTE: [number, number, number][] = [
  [56, 98, 168], // cool blue
  [72, 156, 188], // cyan
  [120, 188, 148], // soft green
  [232, 200, 96], // gold
  [232, 140, 64], // amber
  [196, 72, 72], // warm red
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function samplePalette(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (PALETTE.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const c0 = PALETTE[i];
  const c1 = PALETTE[Math.min(PALETTE.length - 1, i + 1)];
  return [
    Math.round(lerp(c0[0], c1[0], f)),
    Math.round(lerp(c0[1], c1[1], f)),
    Math.round(lerp(c0[2], c1[2], f)),
  ];
}

function tempToRgb(temp: number, min: number, max: number): [number, number, number] {
  const span = max - min || 1;
  return samplePalette((temp - min) / span);
}

function tempToCss(temp: number | null, min: number, max: number) {
  if (temp === null || !Number.isFinite(temp)) return "rgba(210,210,215,0.9)";
  const [r, g, b] = tempToRgb(temp, min, max);
  return `rgb(${r}, ${g}, ${b})`;
}

function shortName(name: string) {
  const m = name.match(/(\d{3})$/);
  if (m) return m[1];
  return name.replace(/^Датчик\s*/i, "").slice(0, 6);
}

type ActivePoint = { id: string; name: string; x: number; y: number; temp: number };

function paintField(
  canvas: HTMLCanvasElement,
  active: ActivePoint[],
  min: number,
  max: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 2 || cssH < 2) return;

  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // Base — cool neutral
  ctx.fillStyle = "#eef1f5";
  ctx.fillRect(0, 0, w, h);

  if (active.length === 0) return;

  // Lower-res IDW grid, then upscale with blur for soft gradients
  const cols = Math.max(48, Math.round(cssW / 10));
  const rows = Math.max(30, Math.round(cssH / 10));
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  const octx = off.getContext("2d");
  if (!octx) return;
  const img = octx.createImageData(cols, rows);
  const data = img.data;

  // Power for IDW — lower = smoother blends
  const power = 2.35;
  const eps = 1e-6;

  for (let y = 0; y < rows; y++) {
    const py = (y + 0.5) / rows;
    for (let x = 0; x < cols; x++) {
      const px = (x + 0.5) / cols;
      let wSum = 0;
      let tSum = 0;

      for (const p of active) {
        const dx = px - p.x;
        const dy = py - p.y;
        // Slight vertical stretch so greenhouse feel is wider
        const dist = Math.sqrt(dx * dx + dy * dy * 0.85) + eps;
        const weight = 1 / dist ** power;
        wSum += weight;
        tSum += weight * p.temp;
      }

      const temp = tSum / wSum;
      const [r, g, b] = tempToRgb(temp, min, max);
      const i = (y * cols + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  octx.putImageData(img, 0, 0);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, w, h);

  // Soft vignette + light grain of depth
  const vignette = ctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    Math.min(w, h) * 0.2,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72,
  );
  vignette.addColorStop(0, "rgba(255,255,255,0.08)");
  vignette.addColorStop(0.55, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(15,23,42,0.18)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Extra soft blooms at sensor cores
  for (const p of active) {
    const [r, g, b] = tempToRgb(p.temp, min, max);
    const cx = p.x * w;
    const cy = p.y * h;
    const radius = Math.min(w, h) * 0.22;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
    glow.addColorStop(0.45, `rgba(${r},${g},${b},0.12)`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function Heatmap({ points }: { points: HeatmapPoint[] }) {
  const [mode, setMode] = useState<"current" | "daily">("current");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => {
    const list: ActivePoint[] = [];
    for (const p of points) {
      const temp = mode === "current" ? p.currentTemp : p.dailyAvgTemp;
      if (temp === null || !Number.isFinite(temp)) continue;
      list.push({ id: p.id, name: p.name, x: p.x, y: p.y, temp });
    }
    return list;
  }, [points, mode]);

  const { min, max, frameMin, frameMax, frameDelta } = useMemo(() => {
    if (active.length === 0) {
      return { min: 16, max: 26, frameMin: null as number | null, frameMax: null as number | null, frameDelta: null as number | null };
    }
    const temps = active.map((p) => p.temp);
    const frameMin = Math.min(...temps);
    const frameMax = Math.max(...temps);
    const frameDelta = frameMax - frameMin;
    let lo = frameMin;
    let hi = frameMax;
    if (hi - lo < 1.2) {
      const mid = (lo + hi) / 2;
      lo = mid - 0.8;
      hi = mid + 0.8;
    } else {
      const pad = (hi - lo) * 0.12;
      lo -= pad;
      hi += pad;
    }
    return { min: lo, max: hi, frameMin, frameMax, frameDelta };
  }, [active]);

  const legendGradient = useMemo(() => {
    const stops = PALETTE.map((c, i) => {
      const pct = (i / (PALETTE.length - 1)) * 100;
      return `rgb(${c[0]},${c[1]},${c[2]}) ${pct}%`;
    }).join(", ");
    return `linear-gradient(90deg, ${stops})`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => paintField(canvas, active, min, max);
    draw();

    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [active, min, max]);

  const hovered = hoverId ? active.find((p) => p.id === hoverId) : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="cab-section-title">Теплова карта</h2>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Градієнт температури по зонах теплиці
          </p>
        </div>
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

      <div
        ref={wrapRef}
        className="cab-panel relative aspect-[16/10] w-full overflow-hidden bg-[#e8edf3]"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* subtle greenhouse outline */}
        <div className="pointer-events-none absolute inset-4 rounded-xl border border-white/25 shadow-[inset_0_0_60px_rgba(255,255,255,0.12)] sm:inset-5" />

        {active.map((p) => {
          const isHover = hoverId === p.id;
          const meta = points.find((x) => x.id === p.id);
          const issue = meta?.issueSeverity ?? null;
          return (
            <button
              key={p.id}
              type="button"
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-left transition-transform duration-200"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${isHover ? 1.06 : 1})`,
              }}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId(null)}
              aria-label={`${p.name}: ${p.temp.toFixed(1)} °C`}
            >
              {issue && (
                <span
                  className={`absolute left-1/2 top-1/2 -z-20 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    issue === "critical" ? "animate-pulse bg-[#ff3b30]/35" : "bg-[#ff9f0a]/30"
                  }`}
                />
              )}
              <span
                className="absolute left-1/2 top-1/2 -z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md sm:h-12 sm:w-12"
                style={{
                  background: tempToCss(p.temp, min, max),
                  opacity: isHover ? 0.55 : 0.35,
                }}
              />
              <span
                className={`flex min-w-[3.25rem] flex-col items-center rounded-2xl border px-2 py-1.5 backdrop-blur-md transition ${
                  issue === "critical"
                    ? "border-[#ff3b30]/70 bg-white/92 shadow-lg shadow-[#ff3b30]/20"
                    : issue === "warn"
                      ? "border-[#ff9f0a]/70 bg-white/90 shadow-md shadow-[#ff9f0a]/15"
                      : isHover
                        ? "border-white/80 bg-white/95 shadow-lg shadow-black/10"
                        : "border-white/50 bg-white/78 shadow-md shadow-black/8"
                }`}
              >
                <span className="text-[10px] font-medium tracking-wide text-[#86868b]">
                  {shortName(p.name)}
                </span>
                <span
                  className="text-[13px] font-semibold tabular-nums tracking-tight sm:text-[14px]"
                  style={{ color: tempToCss(p.temp, min, max) }}
                >
                  {p.temp.toFixed(1)}°
                </span>
              </span>
            </button>
          );
        })}

        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-center sm:bottom-4">
            <div className="rounded-full bg-[#1d1d1f]/78 px-3.5 py-1.5 text-[12px] text-white backdrop-blur-md">
              <span className="font-medium">{hovered.name}</span>
              <span className="mx-1.5 text-white/40">·</span>
              <span className="tabular-nums">{hovered.temp.toFixed(1)} °C</span>
              {points.find((p) => p.id === hovered.id)?.issueSeverity && (
                <>
                  <span className="mx-1.5 text-white/40">·</span>
                  <span className="text-[#ffd60a]">проблемна зона</span>
                </>
              )}
            </div>
          </div>
        )}

        {active.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#86868b]">
            Немає даних для карти
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 text-[12px] text-[#86868b]">Температура</span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-[#86868b]">
            {min.toFixed(1)}°
          </span>
          <div
            className="h-2.5 flex-1 rounded-full shadow-inner ring-1 ring-black/5"
            style={{ background: legendGradient }}
            aria-hidden
          />
          <span className="w-10 shrink-0 text-[12px] tabular-nums text-[#86868b]">
            {max.toFixed(1)}°
          </span>
        </div>
      </div>

      {frameDelta !== null && frameMin !== null && frameMax !== null && (
        <div className="cab-panel flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-[13px]">
          <span className="text-[#86868b]">Найбільша різниця в кадрі (мін → макс)</span>
          <span className="font-semibold tabular-nums tracking-tight text-[#1d1d1f]">
            {frameDelta.toFixed(1)} °C
            <span className="ml-2 font-normal text-[#86868b]">
              ({frameMin.toFixed(1)}° … {frameMax.toFixed(1)}°)
            </span>
          </span>
        </div>
      )}
    </section>
  );
}
