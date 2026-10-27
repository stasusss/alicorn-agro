import { requireOperator } from "@/lib/chat/operator";
import { claimConversation } from "@/lib/chat/service";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    if (access.scope !== "assigned") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const result = await claimConversation(id, access.userId);
    if ("error" in result) {
      if (result.error === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (result.error === "taken") {
        return NextResponse.json({ error: "Цей чат уже взяв інший працівник." }, { status: 409 });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logger.info({ msg: "chat_staff_claim", requestId, conversationId: id, userId: access.userId });
    return NextResponse.json({ conversation: result.conversation });
  } catch (err) {
    logger.error({ msg: "chat_assign_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
