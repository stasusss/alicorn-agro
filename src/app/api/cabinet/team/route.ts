import { requireAdmin } from "@/lib/chat/operator";
import { createStaffMember, listStaff } from "@/lib/cabinet/team";
import { auth } from "@/lib/auth";
import { logger, requestIdFrom } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    return NextResponse.json({ members: await listStaff() });
  } catch (err) {
    logger.error({ msg: "team_list_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const access = await requireAdmin();
    if (!access.ok) return access.response;
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = createSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { error: "Вкажіть ім’я, пошту і пароль щонайменше з 8 символів." },
        { status: 400 },
      );
    }
    const created = await createStaffMember({
      organizationId: session.user.organizationId,
      ...body.data,
    });
    if ("error" in created) {
      return NextResponse.json({ error: "Користувач з такою поштою вже є." }, { status: 409 });
    }
    return NextResponse.json({ user: created.user });
  } catch (err) {
    logger.error({ msg: "team_create_failed", requestId, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
