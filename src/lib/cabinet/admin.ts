import { getDb } from "@/db";
import {
  chatConversations,
  gateways,
  leads,
  organizations,
  readings,
  sensors,
} from "@/db/schema";
import { desc, gte, sql } from "drizzle-orm";

export type ClientStat = {
  id: string;
  name: string;
  sensors: number;
  lastReading: string | null;
  gatewaySeen: string | null;
};

export async function getAdminOverview() {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const onlineSince = new Date(Date.now() - 15 * 60 * 1000);

  const [orgs, sensorRows, gatewayRows, readingCount, chatRows, leadRows, recentChats, recentLeads] =
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
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(readings)
        .where(gte(readings.ts, since)),
      db.select().from(chatConversations),
      db.select().from(leads),
      db.select().from(chatConversations).orderBy(desc(chatConversations.lastMessageAt)).limit(8),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(5),
    ]);

  const lastReadings = await db
    .select({
      organizationId: readings.organizationId,
      lastReading: sql<Date | null>`max(${readings.ts})`,
    })
    .from(readings)
    .groupBy(readings.organizationId);

  const sensorsByOrg = new Map(sensorRows.map((row) => [row.organizationId, row.count]));
  const seenByOrg = new Map(gatewayRows.map((row) => [row.organizationId, row.lastSeen]));
  const readingByOrg = new Map(lastReadings.map((row) => [row.organizationId, row.lastReading]));

  const clients: ClientStat[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    sensors: Number(sensorsByOrg.get(org.id) ?? 0),
    lastReading: toIso(readingByOrg.get(org.id)),
    gatewaySeen: toIso(seenByOrg.get(org.id)),
  }));

  const gatewaysOnline = gatewayRows.filter((row) => {
    const seen = row.lastSeen ? new Date(row.lastSeen) : null;
    return seen !== null && seen >= onlineSince;
  }).length;

  return {
    clients: clients.length,
    sensors: sensorRows.reduce((sum, row) => sum + Number(row.count), 0),
    gatewaysOnline,
    readings24h: Number(readingCount[0]?.count ?? 0),
    chats: chatRows.length,
    chatsWaiting: chatRows.filter((row) => row.status === "human").length,
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

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
