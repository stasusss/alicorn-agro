import { requireOperator } from "@/lib/chat/operator";
import { readKnowledge, saveKnowledge } from "@/lib/chat/knowledge-store";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    return NextResponse.json(await readKnowledge());
  } catch (err) {
    logger.error({ msg: "knowledge_read_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    const body = z.object({ body: z.string() }).safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Немає тексту." }, { status: 400 });
    }
    const saved = await saveKnowledge(body.data.body, access.userId);
    if ("error" in saved) {
      return NextResponse.json({ error: "Текст має бути від 20 до 100000 символів." }, { status: 400 });
    }
    return NextResponse.json(saved);
  } catch (err) {
    logger.error({ msg: "knowledge_save_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
