import { requireOperator } from "@/lib/chat/operator";
import { readStaffConversation } from "@/lib/chat/service";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireOperator();
    if (!access.ok) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const conversation = await readStaffConversation(id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (err) {
    logger.error({ msg: "chat_staff_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
