import { replyScope, requireOperator } from "@/lib/chat/operator";
import { replyAsOperator } from "@/lib/chat/service";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = z.object({ text: z.string() }).safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json({ error: "Напишіть відповідь." }, { status: 400 });
    }
    const result = await replyAsOperator(id, body.data.text, replyScope(access));
    if ("error" in result) {
      const status = result.error === "missing" ? 404 : 400;
      const error = result.error === "missing" ? "Not found" : "Напишіть відповідь до 2000 символів.";
      return NextResponse.json({ error }, { status });
    }
    logger.info({ msg: "chat_staff_reply", requestId, conversationId: id });
    return NextResponse.json({ conversation: result.conversation });
  } catch (err) {
    logger.error({ msg: "chat_staff_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
