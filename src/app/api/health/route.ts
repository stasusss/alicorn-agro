import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Process liveness only. A database query here would keep Neon awake. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
