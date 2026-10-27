import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { hashIp, clientIp } from "@/lib/chat/access";
import { notifyLead } from "@/lib/chat/notify";
import { logger, requestIdFrom } from "@/lib/log";
import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(32),
  email: z.string().trim().email().max(200),
  time: z.string().trim().min(2).max(160),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const parsed = leadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Перевірте поля форми." }, { status: 400 });
    }

    const db = await getDb();
    const ip = hashIp(clientIp(request));
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.ipHash, ip), gte(leads.createdAt, since)));
    if (recent.length >= 5) {
      return NextResponse.json({ error: "Забагато заявок. Спробуйте трохи пізніше." }, { status: 429 });
    }

    const notes = parsed.data.notes ?? "";
    const [lead] = await db
      .insert(leads)
      .values({ ...parsed.data, notes, ipHash: ip })
      .returning();

    await notifyLead({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      time: lead.time,
      notes,
    });

    logger.info({ msg: "lead_created", requestId, leadId: lead.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ msg: "lead_failed", requestId, err });
    return NextResponse.json({ error: "Не вдалося надіслати заявку." }, { status: 500 });
  }
}
