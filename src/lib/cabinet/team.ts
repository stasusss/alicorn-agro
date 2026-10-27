import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

export async function listStaff() {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "staff"))
    .orderBy(users.name);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function createStaffMember(input: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
}) {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "exists" as const };

  const [created] = await db
    .insert(users)
    .values({
      organizationId: input.organizationId,
      email,
      name: input.name.trim(),
      role: "staff",
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: users.id, name: users.name, email: users.email });
  return { user: created };
}
