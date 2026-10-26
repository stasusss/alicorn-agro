import { getDb } from "@/db";
import { logger } from "@/lib/log";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error({ msg: "health_failed", err });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
