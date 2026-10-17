"use client";

import { useState } from "react";

/** One-tap report for "today" in Europe/Kyiv calendar day. */
export function QuickReportButton() {
  const [loading, setLoading] = useState(false);

  async function downloadToday() {
    setLoading(true);
    try {
      const now = new Date();
      // Approximate local day start for Kyiv (UTC+3 in Oct)
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const params = new URLSearchParams({
        from: start.toISOString(),
        to: now.toISOString(),
        format: "html",
      });
      const res = await fetch(`/api/cabinet/report?${params}`);
      if (!res.ok) throw new Error("fail");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alicorn-report-today.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadToday}
      disabled={loading}
      className="cab-btn shrink-0 self-start sm:self-auto"
    >
      {loading ? "Звіт…" : "Звіт за сьогодні"}
    </button>
  );
}
