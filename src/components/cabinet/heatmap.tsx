"use client";

import { Pause, Play } from "lucide-react";
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

type HeatmapFrame = { ts: string; temps: Record<string, number> };

const PLAYBACK_FRAME_MS = 700;
const MIN_PLAYBACK_MS = 28_000;
const MAX_PLAYBACK_MS = 75_000;

function playbackDuration(frameCount: number) {
  const natural = Math.max(1, frameCount - 1) * PLAYBACK_FRAME_MS;
  return Math.min(MAX_PLAYBACK_MS, Math.max(MIN_PLAYBACK_MS, natural));
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialRange(latestTs: string | null) {
  const end = latestTs ? new Date(latestTs) : new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60_000);
  return { from: toLocalInput(start), to: toLocalInput(end) };
}

function formatWhen(date: Date) {
  return date.toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scaleTemps(temps: number[]) {
  if (temps.length === 0) {
    return {
      min: 16,
      max: 26,
      frameMin: null as number | null,
      frameMax: null as number | null,
      frameDelta: null as number | null,
    };
  }
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
}

export function Heatmap({
  points,
  latestTs = null,
}: {
  points: HeatmapPoint[];
  /** ISO time of the newest reading. Playback defaults to the 24 hours before it. */
  latestTs?: string | null;
}) {
  const [mode, setMode] = useState<"current" | "daily">("current");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const defaults = useMemo(() => initialRange(latestTs), [latestTs]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [history, setHistory] = useState<HeatmapFrame[] | null>(null);
  const [bucketMinutes, setBucketMinutes] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);
  const historyRef = useRef<HeatmapFrame[] | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (!playing) progressRef.current = progress;
  }, [progress, playing]);

  const showingHistory = !live && history !== null && history.length > 0;

  const active = useMemo(() => {
    if (showingHistory && history) {
      const last = history.length - 1;
      const pos = progress * last;
      const index = Math.min(last, Math.floor(pos));
      const next = Math.min(last, index + 1);
      const mix = history.length === 1 ? 0 : pos - index;
      const fromFrame = history[index];
      const toFrame = history[next];
      const list: ActivePoint[] = [];
      for (const p of points) {
        const a = fromFrame.temps[p.id];
        const b = toFrame.temps[p.id];
        const temp = a == null ? b : b == null ? a : a + (b - a) * mix;
        if (temp == null || !Number.isFinite(temp)) continue;
        list.push({ id: p.id, name: p.name, x: p.x, y: p.y, temp });
      }
      return list;
    }

    const list: ActivePoint[] = [];
    for (const p of points) {
      const temp = mode === "current" ? p.currentTemp : p.dailyAvgTemp;
      if (temp === null || !Number.isFinite(temp)) continue;
      list.push({ id: p.id, name: p.name, x: p.x, y: p.y, temp });
    }
    return list;
  }, [points, mode, showingHistory, history, progress]);

  const { min, max, frameMin, frameMax, frameDelta } = useMemo(() => {
    if (showingHistory && history) {
      const temps: number[] = [];
      for (const frame of history) {
        for (const value of Object.values(frame.temps)) {
          if (Number.isFinite(value)) temps.push(value);
        }
      }
      const scale = scaleTemps(temps);
      const frameTemps = active.map((p) => p.temp);
      return {
        ...scale,
        frameMin: frameTemps.length ? Math.min(...frameTemps) : null,
        frameMax: frameTemps.length ? Math.max(...frameTemps) : null,
        frameDelta: frameTemps.length ? Math.max(...frameTemps) - Math.min(...frameTemps) : null,
      };
    }
    return scaleTemps(active.map((p) => p.temp));
  }, [active, showingHistory, history]);

  const playbackLabel = useMemo(() => {
    if (!showingHistory || !history || history.length === 0) return null;
    const last = history.length - 1;
    const pos = progress * last;
    const index = Math.min(last, Math.floor(pos));
    const next = Math.min(last, index + 1);
    const mix = history.length === 1 ? 0 : pos - index;
    const t0 = new Date(history[index].ts).getTime();
    const t1 = new Date(history[next].ts).getTime();
    return formatWhen(new Date(t0 + (t1 - t0) * mix));
  }, [showingHistory, history, progress]);

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

  useEffect(() => {
    if (!playing) return;
    const frames = historyRef.current;
    if (!frames || frames.length < 2) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const total = playbackDuration(frames.length);

    const tick = (now: number) => {
      // A slow paint must not skip the whole period in one frame.
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      acc += dt;
      if (acc >= 80) {
        const step = acc;
        acc = 0;
        const next = progressRef.current + step / total;
        if (next >= 1) {
          progressRef.current = 1;
          setProgress(1);
          setPlaying(false);
          return;
        }
        progressRef.current = next;
        setProgress(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  function resetPlayback() {
    setPlaying(false);
    setLive(true);
    setHistory(null);
    setBucketMinutes(null);
    setProgress(0);
    loadedKey.current = null;
  }

  async function ensureFrames() {
    const key = `${from}|${to}`;
    if (loadedKey.current === key && historyRef.current) return historyRef.current;

    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      setPlayError("Вкажіть період: дата «з» має бути раніше за «до».");
      return null;
    }

    setLoading(true);
    setPlayError(null);
    try {
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: end.toISOString(),
      });
      const res = await fetch(`/api/cabinet/heatmap?${params}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        bucketMinutes?: number;
        frames?: HeatmapFrame[];
      };
      if (!res.ok) throw new Error(data.error ?? "Не вдалося завантажити період");
      const frames = data.frames ?? [];
      if (frames.length === 0) {
        setHistory(null);
        loadedKey.current = null;
        setPlayError("Немає вимірів за цей період.");
        return null;
      }
      setHistory(frames);
      setBucketMinutes(data.bucketMinutes ?? null);
      setProgress(0);
      loadedKey.current = key;
      return frames;
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : "Помилка");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function startPlayback() {
    const frames = await ensureFrames();
    if (!frames || frames.length === 0) return;
    setLive(false);
    if (frames.length < 2) {
      setProgress(0);
      setPlaying(false);
      return;
    }
    if (progressRef.current >= 0.999) {
      progressRef.current = 0;
      setProgress(0);
    }
    setPlaying(true);
  }

  function pausePlayback() {
    setPlaying(false);
  }

  function showLive(next: "current" | "daily") {
    setMode(next);
    setPlaying(false);
    setLive(true);
  }

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
            onClick={() => showLive("current")}
            className={`rounded-full px-3.5 py-1.5 transition ${
              mode === "current" && !showingHistory
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            Поточна
          </button>
          <button
            type="button"
            onClick={() => showLive("daily")}
            className={`rounded-full px-3.5 py-1.5 transition ${
              mode === "daily" && !showingHistory
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
        className="cab-panel relative aspect-[4/5] w-full overflow-hidden bg-[#e8edf3] sm:aspect-[16/10]"
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
              className="absolute z-10 text-left transition-transform duration-200"
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
              {issue && !showingHistory && (
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

        {showingHistory && playbackLabel && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#1d1d1f]/78 px-3 py-1 text-[12px] font-medium text-white backdrop-blur-md">
            {playbackLabel}
          </div>
        )}

        {hovered && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex justify-center sm:bottom-4">
            <div className="rounded-full bg-[#1d1d1f]/78 px-3.5 py-1.5 text-[12px] text-white backdrop-blur-md">
              <span className="font-medium">{hovered.name}</span>
              <span className="mx-1.5 text-white/40">·</span>
              <span className="tabular-nums">{hovered.temp.toFixed(1)} °C</span>
              {!showingHistory && points.find((p) => p.id === hovered.id)?.issueSeverity && (
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

      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[12px] text-[#86868b]">
            З
            <input
              type="datetime-local"
              className="cab-input"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                resetPlayback();
              }}
            />
          </label>
          <label className="text-[12px] text-[#86868b]">
            До
            <input
              type="datetime-local"
              className="cab-input"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                resetPlayback();
              }}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startPlayback()}
            disabled={loading}
            aria-pressed={playing}
            className="cab-btn min-h-11 flex-1 gap-2 sm:flex-none"
          >
            <Play className="h-4 w-4" aria-hidden />
            {loading ? "Завантаження…" : "Запуск"}
          </button>
          <button
            type="button"
            onClick={pausePlayback}
            disabled={!playing}
            className="cab-btn-ghost inline-flex min-h-11 flex-1 items-center justify-center gap-2 disabled:opacity-40 sm:flex-none"
          >
            <Pause className="h-4 w-4" aria-hidden />
            Пауза
          </button>
          <span className="min-w-0 flex-1 text-right text-[13px] font-medium tabular-nums text-[#1d1d1f]">
            {playbackLabel ?? "Наживо"}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={history && history.length > 1 ? Math.round(progress * 1000) : 0}
          disabled={!history || history.length < 2}
          aria-label="Час на тепловій карті"
          aria-valuetext={playbackLabel ?? "Наживо"}
          onChange={(event) => {
            setPlaying(false);
            setLive(false);
            setProgress(Number(event.target.value) / 1000);
          }}
          className="h-8 w-full cursor-pointer accent-[#1d1d1f] disabled:cursor-default disabled:opacity-40"
        />

        <p className="text-[12px] text-[#86868b]">
          {playError
            ? playError
            : bucketMinutes && history
              ? `Крок ${bucketMinutes} хв · ${history.length} ${history.length === 1 ? "кадр" : "кадрів"}`
              : "Оберіть період і натисніть «Запуск» — карта повільно пройде його в часі."}
        </p>
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
