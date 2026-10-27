import { getDb } from "@/db";
import { organizations, users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

export async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    if (existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
    }
    return;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Alicorn Agro",
      latitude: 50.4501,
      longitude: 30.5234,
      timezone: "Europe/Kyiv",
    })
    .returning();

  await db.insert(users).values({
    organizationId: org.id,
    email,
    name: "Адміністратор",
    role: "admin",
    passwordHash: await hashPassword(password),
  });
}
