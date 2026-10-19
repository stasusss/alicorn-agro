import { auth } from "@/lib/auth";
import { getHeatmapFrames } from "@/lib/cabinet/queries";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
});

const MAX_SPAN_MS = 31 * 24 * 60 * 60_000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Невірний період" }, { status: 400 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (!(from < to)) {
    return NextResponse.json({ error: "Дата «з» має бути раніше за «до»" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_SPAN_MS) {
    return NextResponse.json({ error: "Період не довший за 31 день" }, { status: 400 });
  }

  const result = await getHeatmapFrames({
    organizationId: session.user.organizationId,
    from,
    to,
  });

  return NextResponse.json(result);
}
