import { getDb } from "@/db";
import { alertRules } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canReadMeasurements } from "@/lib/cabinet/measurement-access";
import { logger, requestIdFrom } from "@/lib/log";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request);
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      logger.warn({ msg: "cabinet_unauthorized", requestId, route: "alerts" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReadMeasurements(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null));
    if (!body.success) {
      logger.warn({ msg: "cabinet_bad_request", requestId, route: "alerts" });
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
  } catch (err) {
    logger.error({ msg: "cabinet_failed", requestId, route: "alerts", err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request);
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      logger.warn({ msg: "cabinet_unauthorized", requestId, route: "alerts" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canReadMeasurements(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    logger.info({
      msg: "alert_rule_deleted",
      requestId,
      ruleId: id,
      organizationId: session.user.organizationId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ msg: "cabinet_failed", requestId, route: "alerts", err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
