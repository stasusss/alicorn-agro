import { getDb } from "@/db";
import { knowledgeDocuments } from "@/db/schema";
import { buildKnowledgeBase } from "@/lib/chat/knowledge";
import { eq } from "drizzle-orm";

const DOCUMENT_ID = "chat";
const MAX_BODY = 100_000;

export async function readKnowledge() {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, DOCUMENT_ID))
    .limit(1);
  if (!row) {
    return { body: buildKnowledgeBase(), updatedAt: null, customized: false };
  }
  return { body: row.body, updatedAt: row.updatedAt.toISOString(), customized: true };
}

export async function knowledgeForPrompt() {
  const document = await readKnowledge();
  return document.customized ? document.body : buildKnowledgeBase();
}

export async function saveKnowledge(body: string, userId: string) {
  const text = body.trim();
  if (text.length < 20 || text.length > MAX_BODY) return { error: "length" as const };
  const db = await getDb();
  const now = new Date();
  await db
    .insert(knowledgeDocuments)
    .values({ id: DOCUMENT_ID, body: text, updatedAt: now, updatedBy: userId })
    .onConflictDoUpdate({
      target: knowledgeDocuments.id,
      set: { body: text, updatedAt: now, updatedBy: userId },
    });
  return { ok: true as const, updatedAt: now.toISOString() };
}
