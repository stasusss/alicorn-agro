import { ExportForm } from "@/components/cabinet/export-form";
import { ReportForm } from "@/components/cabinet/report-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Експорт і звіти",
};

export default function ExportPage() {
  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <h1 className="cab-title">Експорт і звіти</h1>
        <p className="cab-subtitle">
          Замовте аналітичний звіт за період або завантажте сирі дані у CSV.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ReportForm />
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-[#86868b]">Сирі дані</p>
          <ExportForm />
        </div>
      </div>
    </div>
  );
}
