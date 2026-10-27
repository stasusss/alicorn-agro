import { readScope, requireOperator } from "@/lib/chat/operator";
import { listStaffConversations } from "@/lib/chat/service";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    const conversations = await listStaffConversations(readScope(access));
    return NextResponse.json({ conversations });
  } catch (err) {
    logger.error({ msg: "chat_staff_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
