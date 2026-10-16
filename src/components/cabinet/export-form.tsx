"use client";

import { useState } from "react";

export function ExportForm() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));

  function download() {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
    });
    window.location.href = `/api/cabinet/export?${params}`;
  }

  return (
    <div className="cab-panel max-w-md space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="cab-section-title" style={{ fontSize: "1.15rem" }}>
          CSV
        </h2>
        <p className="mt-1 text-[13px] text-[#86868b]">
          Повний набір вимірювань без аналітики.
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
      <button type="button" onClick={download} className="cab-btn mt-2">
        Завантажити CSV
      </button>
    </div>
  );
}
