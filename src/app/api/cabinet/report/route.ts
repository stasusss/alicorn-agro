import { auth } from "@/lib/auth";
import { buildAnalyticsReport, renderReportHtml } from "@/lib/cabinet/report";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  format: z.enum(["html", "pdf"]).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    format: url.searchParams.get("format") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (to <= from) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 90 * 24 * 3600 * 1000) {
    return NextResponse.json({ error: "Max range is 90 days" }, { status: 400 });
  }

  const report = await buildAnalyticsReport(session.user.organizationId, from, to);
  const asPdf = parsed.data.format === "pdf";
  const html = renderReportHtml(report, { autoPrint: asPdf });
  const stamp = from.toISOString().slice(0, 10);
  const stampTo = to.toISOString().slice(0, 10);
  const filename = `alicorn-report-${stamp}_${stampTo}.html`;

  // PDF = print-optimized HTML (browser "Save as PDF"). True binary PDF needs a heavier renderer.
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": asPdf ? "inline" : `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
