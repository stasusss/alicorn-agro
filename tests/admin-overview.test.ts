import { getDb } from "@/db";
import { chatConversations, chatMessages, leads, organizations, users } from "@/db/schema";
import { getAdminOverview } from "@/lib/cabinet/admin";
import { describe, expect, it } from "vitest";

describe("admin overview staff stats", () => {
  it("counts assigned chats, phone conversion and staff replies", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organizations)
      .values({ name: "Alicorn", latitude: 50.45, longitude: 30.52 })
      .returning();
    const [olena] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        email: "olena@example.com",
        passwordHash: "hash",
        name: "Олена",
        role: "staff",
      })
      .returning();
    await db.insert(users).values({
      organizationId: org.id,
      email: "ihor@example.com",
      passwordHash: "hash",
      name: "Ігор",
      role: "staff",
    });

    const [withPhone, closed, loose] = await db
      .insert(chatConversations)
      .values([
        {
          visitorTokenHash: "token-phone",
          ipHash: "ip-1",
          assignedUserId: olena.id,
          visitorPhone: "+380931112233",
          visitorName: "Марія",
          status: "human",
        },
        {
          visitorTokenHash: "token-closed",
          ipHash: "ip-2",
          assignedUserId: olena.id,
          status: "closed",
        },
        {
          visitorTokenHash: "token-loose",
          ipHash: "ip-3",
          visitorPhone: "+380507778899",
          status: "human",
        },
      ])
      .returning();

    await db.insert(chatMessages).values([
      { conversationId: withPhone.id, role: "staff", body: "Добрий день" },
      { conversationId: withPhone.id, role: "staff", body: "Передзвонимо" },
      { conversationId: loose.id, role: "visitor", body: "Потрібна консультація" },
    ]);
    await db.insert(leads).values({
      name: "Петро",
      phone: "+380671234567",
      email: "petro@example.com",
      time: "ранок",
    });

    const overview = await getAdminOverview();
    expect(overview.chats).toBe(3);
    expect(overview.chatsWithPhone).toBe(2);
    expect(overview.chatsWaiting).toBe(2);
    expect(overview.chatsClosed).toBe(1);
    expect(overview.chatsAnswered).toBe(1);
    expect(overview.leads).toBe(1);
    expect(overview.unassigned).toMatchObject({ chats: 1, withPhone: 1, waiting: 1, answered: 0, replies: 0 });

    const olenaRow = overview.staff.find((row) => row.id === olena.id);
    const ihorRow = overview.staff.find((row) => row.email === "ihor@example.com");
    expect(olenaRow).toMatchObject({
      chats: 2,
      withPhone: 1,
      waiting: 1,
      closed: 1,
      answered: 1,
      replies: 2,
    });
    expect(ihorRow).toMatchObject({ chats: 0, withPhone: 0, replies: 0 });
    expect(overview.staff[0]?.id).toBe(olena.id);
    expect(closed.assignedUserId).toBe(olena.id);
  });
});
