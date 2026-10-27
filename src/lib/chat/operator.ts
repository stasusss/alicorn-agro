import { auth } from "@/lib/auth";
import { isChatOperator } from "@/lib/chat/access";
import type { ConversationScope } from "@/lib/chat/service";
import { NextResponse } from "next/server";

type OperatorGate =
  | { ok: true; email: string; userId: string; scope: "all" | "assigned" }
  | { ok: false; response: NextResponse };

export async function requireOperator(): Promise<OperatorGate> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !session.user.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isChatOperator(email, session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    ok: true,
    email,
    userId: session.user.id,
    scope: session.user.role === "staff" ? "assigned" : "all",
  };
}

export function readScope(access: Extract<OperatorGate, { ok: true }>): ConversationScope {
  return access.scope === "assigned" ? { kind: "queue", userId: access.userId } : { kind: "all" };
}

export function replyScope(access: Extract<OperatorGate, { ok: true }>): ConversationScope {
  return access.scope === "assigned" ? { kind: "assigned", userId: access.userId } : { kind: "all" };
}

export async function requireAdmin(): Promise<OperatorGate> {
  const access = await requireOperator();
  if (!access.ok) return access;
  if (access.scope !== "all") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return access;
}
