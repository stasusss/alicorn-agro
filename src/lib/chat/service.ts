import { getDb } from "@/db";
import { chatConversations, chatMessages, type ChatConversation } from "@/db/schema";
import { aiEnabled, completeChat } from "@/lib/chat/ai";
import {
  CHAT_LIMITS,
  hashVisitorToken,
  isVisitorToken,
  newVisitorToken,
} from "@/lib/chat/access";
import {
  ASSISTANT_CONNECTED,
  ASSISTANT_NO_AI,
  contactRequest,
  extractName,
  extractPhone,
  wantsHuman,
} from "@/lib/chat/intent";
import { notifyOperators } from "@/lib/chat/notify";
import { logger } from "@/lib/log";
import { and, asc, desc, eq, gte } from "drizzle-orm";

export type PublicMessage = {
  id: string;
  role: "visitor" | "assistant" | "staff";
  body: string;
  createdAt: string;
};

export type PublicConversation = {
  id: string;
  status: "ai" | "human" | "closed";
  visitorName: string | null;
  visitorPhone: string | null;
  messages: PublicMessage[];
};

export type StaffConversation = {
  id: string;
  status: "ai" | "human" | "closed";
  visitorName: string | null;
  visitorPhone: string | null;
  pageUrl: string | null;
  lastMessageAt: string;
  preview: string;
};

type Ok = { ok: true; conversation: PublicConversation; token: string | null };
type Fail = { ok: false; status: 400 | 429; error: string };

function hourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

function toPublic(conversation: ChatConversation, messages: PublicMessage[]): PublicConversation {
  return {
    id: conversation.id,
    status: conversation.status,
    visitorName: conversation.visitorName,
    visitorPhone: conversation.visitorPhone,
    messages,
  };
}

async function loadMessages(conversationId: string): Promise<PublicMessage[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function snapshot(conversationId: string): Promise<PublicConversation> {
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .limit(1);
  if (!conversation) throw new Error("conversation missing");
  return toPublic(conversation, await loadMessages(conversationId));
}

async function addMessage(conversationId: string, role: PublicMessage["role"], body: string) {
  const db = await getDb();
  const [row] = await db.insert(chatMessages).values({ conversationId, role, body }).returning();
  await db
    .update(chatConversations)
    .set({ lastMessageAt: row.createdAt, updatedAt: row.createdAt })
    .where(eq(chatConversations.id, conversationId));
  return row;
}

async function findByToken(token: string | null) {
  if (!isVisitorToken(token)) return null;
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.visitorTokenHash, hashVisitorToken(token)))
    .limit(1);
  return conversation ?? null;
}

export async function readVisitorConversation(token: string | null) {
  const conversation = await findByToken(token);
  if (!conversation) return null;
  return toPublic(conversation, await loadMessages(conversation.id));
}

function contactFrom(conversation: ChatConversation, text: string, acceptName: boolean) {
  return {
    name: conversation.visitorName ?? (acceptName ? extractName(text) : null),
    phone: conversation.visitorPhone ?? extractPhone(text),
  };
}

async function saveContact(
  conversationId: string,
  contact: { name: string | null; phone: string | null },
  patch: Partial<Pick<ChatConversation, "status" | "handoffRequested">>,
) {
  const db = await getDb();
  await db
    .update(chatConversations)
    .set({
      visitorName: contact.name,
      visitorPhone: contact.phone,
      updatedAt: new Date(),
      ...patch,
    })
    .where(eq(chatConversations.id, conversationId));
}

async function handoff(
  conversation: ChatConversation,
  text: string,
  acceptName: boolean,
) {
  const contact = contactFrom(conversation, text, acceptName);
  const ready = Boolean(contact.name && contact.phone);
  if (!ready) {
    await saveContact(conversation.id, contact, { handoffRequested: true });
    await addMessage(conversation.id, "assistant", contactRequest(contact.name, contact.phone));
    return snapshot(conversation.id);
  }

  await saveContact(conversation.id, contact, { status: "human", handoffRequested: true });
  await addMessage(conversation.id, "assistant", ASSISTANT_CONNECTED);
  await notifyOperators({
    conversationId: conversation.id,
    kind: "handoff",
    visitorName: contact.name,
    visitorPhone: contact.phone,
    text,
  });
  return snapshot(conversation.id);
}

export async function postVisitorMessage(input: {
  token: string | null;
  ipHash: string;
  text: string;
  pageUrl: string | null;
}): Promise<Ok | Fail> {
  const text = input.text.trim();
  if (!text || text.length > CHAT_LIMITS.messageMax) {
    return { ok: false, status: 400, error: "Напишіть повідомлення до 2000 символів." };
  }

  const db = await getDb();
  let conversation = await findByToken(input.token);
  let token: string | null = null;

  if (!conversation) {
    const since = hourAgo();
    const recent = await db
      .select({ id: chatConversations.id })
      .from(chatConversations)
      .where(and(eq(chatConversations.ipHash, input.ipHash), gte(chatConversations.createdAt, since)));
    if (recent.length >= CHAT_LIMITS.conversationsPerIpPerHour) {
      logger.warn({ msg: "chat_rate_limited", reason: "conversations" });
      return { ok: false, status: 429, error: "Забагато нових діалогів. Спробуйте трохи пізніше." };
    }

    token = newVisitorToken();
    const [created] = await db
      .insert(chatConversations)
      .values({
        visitorTokenHash: hashVisitorToken(token),
        ipHash: input.ipHash,
        pageUrl: input.pageUrl,
      })
      .returning();
    conversation = created;
  }

  const since = hourAgo();
  const recentMessages = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversation.id),
        eq(chatMessages.role, "visitor"),
        gte(chatMessages.createdAt, since),
      ),
    );
  if (recentMessages.length >= CHAT_LIMITS.messagesPerHour) {
    logger.warn({ msg: "chat_rate_limited", reason: "messages" });
    return { ok: false, status: 429, error: "Забагато повідомлень. Спробуйте трохи пізніше." };
  }

  await addMessage(conversation.id, "visitor", text);
  const [fresh] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, conversation.id))
    .limit(1);
  conversation = fresh ?? conversation;

  if (conversation.status === "human" || conversation.status === "closed") {
    const contact = contactFrom(conversation, text, true);
    await saveContact(conversation.id, contact, { status: "human" });
    await notifyOperators({
      conversationId: conversation.id,
      kind: "message",
      visitorName: contact.name,
      visitorPhone: contact.phone,
      text,
    });
    return { ok: true, conversation: await snapshot(conversation.id), token };
  }

  if (!aiEnabled()) {
    const contact = contactFrom(conversation, text, true);
    await saveContact(conversation.id, contact, { status: "human", handoffRequested: true });
    await addMessage(
      conversation.id,
      "assistant",
      contact.name && contact.phone ? ASSISTANT_CONNECTED : ASSISTANT_NO_AI,
    );
    await notifyOperators({
      conversationId: conversation.id,
      kind: "handoff",
      visitorName: contact.name,
      visitorPhone: contact.phone,
      text,
    });
    return { ok: true, conversation: await snapshot(conversation.id), token };
  }

  if (wantsHuman(text) || conversation.handoffRequested) {
    return {
      ok: true,
      conversation: await handoff(conversation, text, true),
      token,
    };
  }

  const history = await loadMessages(conversation.id);
  let answer: { text: string; handoff: boolean };
  try {
    answer = await completeChat(history);
  } catch (err) {
    logger.error({ msg: "chat_ai_failed", err });
    answer = { text: "", handoff: true };
  }

  if (answer.handoff) {
    return {
      ok: true,
      conversation: await handoff(conversation, text, true),
      token,
    };
  }

  await addMessage(conversation.id, "assistant", answer.text);
  return { ok: true, conversation: await snapshot(conversation.id), token };
}

export async function listStaffConversations(): Promise<StaffConversation[]> {
  const db = await getDb();
  const conversations = await db
    .select()
    .from(chatConversations)
    .orderBy(desc(chatConversations.lastMessageAt));

  const listed: StaffConversation[] = [];
  for (const conversation of conversations) {
    const [latest] = await db
      .select({ body: chatMessages.body })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversation.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1);
    listed.push({
      id: conversation.id,
      status: conversation.status,
      visitorName: conversation.visitorName,
      visitorPhone: conversation.visitorPhone,
      pageUrl: conversation.pageUrl,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      preview: latest?.body.slice(0, 140) ?? "",
    });
  }
  return listed;
}

export async function readStaffConversation(id: string) {
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);
  if (!conversation) return null;
  return toPublic(conversation, await loadMessages(id));
}

export async function replyAsOperator(id: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > CHAT_LIMITS.messageMax) return { error: "empty" as const };
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);
  if (!conversation) return { error: "missing" as const };

  await addMessage(id, "staff", trimmed);
  await db
    .update(chatConversations)
    .set({ status: "human", handoffRequested: true, updatedAt: new Date() })
    .where(eq(chatConversations.id, id));
  return { conversation: await snapshot(id) };
}
