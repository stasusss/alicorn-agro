"use client";

import { useState } from "react";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReportForm() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 12);
    return toLocalInput(d);
  });
  const [to, setTo] = useState(() => toLocalInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function orderReport() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });
      const res = await fetch(`/api/cabinet/report?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Не вдалося сформувати звіт");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "alicorn-report.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cab-panel max-w-md space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="cab-section-title" style={{ fontSize: "1.15rem" }}>
          Аналітичний звіт
        </h2>
        <p className="mt-1 text-[13px] text-[#86868b]">
          Середні T / RH / VPD, проблемні зони й періоди, короткий висновок.
        </p>
      </div>
      <label className="block text-[13px] text-[#86868b]">
        Від
        <input
          type="datetime-local"
          className="cab-input"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label className="block text-[13px] text-[#86868b]">
        До
        <input
          type="datetime-local"
          className="cab-input"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
      {error && <p className="text-[13px] text-[#ff3b30]">{error}</p>}
      <button
        type="button"
        onClick={orderReport}
        disabled={loading}
        className="cab-btn mt-2"
      >
        {loading ? "Формуємо…" : "Замовити звіт"}
      </button>
    </div>
  );
}
