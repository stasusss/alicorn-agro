import { auth } from "@/lib/auth";
import { isChatOperator } from "@/lib/chat/access";
import { NextResponse } from "next/server";

type OperatorGate =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse };

export async function requireOperator(): Promise<OperatorGate> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isChatOperator(email, session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, email };
}
