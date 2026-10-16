import { getDb } from "@/db";
import { alertRules } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const db = await getDb();
  const [updated] = await db
    .update(alertRules)
    .set({ enabled: body.data.enabled })
    .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, session.user.organizationId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();
  const deleted = await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, id), eq(alertRules.organizationId, session.user.organizationId)))
    .returning({ id: alertRules.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
