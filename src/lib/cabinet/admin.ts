import { getDb } from "@/db";
import {
  chatConversations,
  chatMessages,
  gateways,
  leads,
  organizations,
  sensors,
  users,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type ClientStat = {
  id: string;
  name: string;
  sensors: number;
  gatewaySeen: string | null;
};

export type StaffStat = {
  id: string;
  name: string;
  email: string;
  chats: number;
  withPhone: number;
  waiting: number;
  closed: number;
  answered: number;
  replies: number;
  lastMessageAt: string | null;
};

export type ChatBucket = {
  chats: number;
  withPhone: number;
  waiting: number;
  closed: number;
  answered: number;
  replies: number;
};

export async function getAdminOverview() {
  const db = await getDb();
  const onlineSince = new Date(Date.now() - 15 * 60 * 1000);

  const [orgs, sensorRows, gatewayRows, chatRows, leadRows, recentChats, recentLeads, staffUsers, replyRows] =
    await Promise.all([
      db.select().from(organizations).orderBy(organizations.name),
      db
        .select({
          organizationId: sensors.organizationId,
          count: sql<number>`count(*)::int`,
        })
        .from(sensors)
        .groupBy(sensors.organizationId),
      db
        .select({
          organizationId: gateways.organizationId,
          lastSeen: sql<Date | null>`max(${gateways.lastSeenAt})`,
        })
        .from(gateways)
        .groupBy(gateways.organizationId),
      db.select().from(chatConversations),
      db.select().from(leads),
      db.select().from(chatConversations).orderBy(desc(chatConversations.lastMessageAt)).limit(8),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(5),
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.role, "staff"))
        .orderBy(users.name),
      db
        .select({
          conversationId: chatMessages.conversationId,
          replies: sql<number>`count(*)::int`,
        })
        .from(chatMessages)
        .where(eq(chatMessages.role, "staff"))
        .groupBy(chatMessages.conversationId),
    ]);

  const sensorsByOrg = new Map(sensorRows.map((row) => [row.organizationId, row.count]));
  const seenByOrg = new Map(gatewayRows.map((row) => [row.organizationId, row.lastSeen]));

  const clients: ClientStat[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    sensors: Number(sensorsByOrg.get(org.id) ?? 0),
    gatewaySeen: toIso(seenByOrg.get(org.id)),
  }));

  const gatewaysOnline = gatewayRows.filter((row) => {
    const seen = row.lastSeen ? new Date(row.lastSeen) : null;
    return seen !== null && seen >= onlineSince;
  }).length;

  const repliesByChat = new Map(replyRows.map((row) => [row.conversationId, Number(row.replies)]));
  const byUser = new Map<string, ReturnType<typeof emptyWork>>();
  const unassigned = emptyWork();
  for (const chat of chatRows) {
    const replies = repliesByChat.get(chat.id) ?? 0;
    const bucket = chat.assignedUserId ? byUser.get(chat.assignedUserId) ?? emptyWork() : unassigned;
    if (chat.assignedUserId) byUser.set(chat.assignedUserId, bucket);
    addChat(bucket, chat, replies);
  }

  const staff: StaffStat[] = staffUsers.map((user) => {
    const work = byUser.get(user.id) ?? emptyWork();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      ...counts(work),
      lastMessageAt: toIso(work.lastMessageAt),
    };
  });
  staff.sort((a, b) => b.chats - a.chats || a.name.localeCompare(b.name, "uk"));

  const pipeline = emptyWork();
  for (const chat of chatRows) addChat(pipeline, chat, repliesByChat.get(chat.id) ?? 0);

  return {
    clients: clients.length,
    sensors: sensorRows.reduce((sum, row) => sum + Number(row.count), 0),
    gatewaysOnline,
    chats: chatRows.length,
    chatsWithPhone: pipeline.withPhone,
    chatsWaiting: pipeline.waiting,
    chatsClosed: pipeline.closed,
    chatsAnswered: pipeline.answered,
    unassigned: counts(unassigned),
    staff,
    leads: leadRows.length,
    clientRows: clients,
    recentChats: recentChats.map((row) => ({
      id: row.id,
      name: row.visitorName,
      phone: row.visitorPhone,
      status: row.status,
      lastMessageAt: row.lastMessageAt.toISOString(),
    })),
    recentLeads: recentLeads.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      time: row.time,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function emptyWork() {
  return {
    chats: 0,
    withPhone: 0,
    waiting: 0,
    closed: 0,
    answered: 0,
    replies: 0,
    lastMessageAt: null as Date | null,
  };
}

function addChat(
  bucket: ReturnType<typeof emptyWork>,
  chat: { visitorPhone: string | null; status: string; lastMessageAt: Date },
  replies: number,
) {
  bucket.chats += 1;
  if (chat.visitorPhone?.trim()) bucket.withPhone += 1;
  if (chat.status === "human") bucket.waiting += 1;
  if (chat.status === "closed") bucket.closed += 1;
  if (replies > 0) bucket.answered += 1;
  bucket.replies += replies;
  if (!bucket.lastMessageAt || chat.lastMessageAt > bucket.lastMessageAt) {
    bucket.lastMessageAt = chat.lastMessageAt;
  }
}

function counts(work: ReturnType<typeof emptyWork>): ChatBucket {
  return {
    chats: work.chats,
    withPhone: work.withPhone,
    waiting: work.waiting,
    closed: work.closed,
    answered: work.answered,
    replies: work.replies,
  };
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
