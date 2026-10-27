import {
  CHAT_COOKIE,
  clientIp,
  hashIp,
  readCookie,
  safePageUrl,
} from "@/lib/chat/access";
import { postVisitorMessage, readVisitorConversation } from "@/lib/chat/service";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";

function withCookie(response: NextResponse, token: string | null) {
  if (!token) return response;
  response.cookies.set(CHAT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const conversation = await readVisitorConversation(readCookie(request, CHAT_COOKIE));
    return NextResponse.json({ conversation });
  } catch (err) {
    logger.error({ msg: "chat_failed", requestId, err });
    return NextResponse.json({ error: "Не вдалося відкрити чат." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const body = (await request.json().catch(() => null)) as { text?: unknown; pageUrl?: unknown } | null;
    const text = typeof body?.text === "string" ? body.text : "";
    const result = await postVisitorMessage({
      token: readCookie(request, CHAT_COOKIE),
      ipHash: hashIp(clientIp(request)),
      text,
      pageUrl: safePageUrl(body?.pageUrl),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    logger.info({ msg: "chat_message", requestId, conversationId: result.conversation.id });
    return withCookie(NextResponse.json({ conversation: result.conversation }), result.token);
  } catch (err) {
    logger.error({ msg: "chat_failed", requestId, err });
    return NextResponse.json({ error: "Не вдалося надіслати повідомлення." }, { status: 500 });
  }
}
