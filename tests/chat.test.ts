import { GET as getChat, POST as postChat } from "@/app/api/chat/route";
import { GET as getStaff } from "@/app/api/staff/chat/route";
import { POST as postReply } from "@/app/api/staff/chat/[id]/reply/route";
import { buildChatSystemPrompt } from "@/lib/chat/prompt";
import { site } from "@/lib/site";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

let ip = 20;

beforeEach(() => {
  ip += 1;
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  delete process.env.CHAT_AI_API_KEY;
  delete process.env.CHAT_OPERATOR_EMAILS;
  delete process.env.CHAT_TELEGRAM_CHAT_ID;
  vi.unstubAllGlobals();
});

function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", `203.0.113.${ip}`);
  return new Request(`http://localhost${path}`, { ...init, headers });
}

function cookieHeader(response: Response) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const line = lines.find((item) => item.startsWith("chat_visitor=")) ?? response.headers.get("set-cookie") ?? "";
  const match = line.match(/chat_visitor=([^;]+)/);
  if (!match) throw new Error("missing chat cookie");
  return `chat_visitor=${match[1]}`;
}

describe("chat prompt", () => {
  it("includes public contacts and leaves secrets out", () => {
    process.env.CHAT_AI_API_KEY = "sk-super-secret-key";
    process.env.TELEGRAM_BOT_TOKEN = "telegram-secret-token";
    const prompt = buildChatSystemPrompt();
    expect(prompt).toContain(site.email);
    expect(prompt).toContain(site.phone);
    expect(prompt).toContain("Дослідження ґрунтів");
    expect(prompt).toContain("ClimateGuard");
    expect(prompt).not.toContain("sk-super-secret-key");
    expect(prompt).not.toContain("telegram-secret-token");
    expect(prompt).not.toContain(process.env.AUTH_SECRET);
  });
});

describe("visitor chat", () => {
  it("does not let one visitor read another conversation", async () => {
    const first = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Унікальний запит альфа 771" }),
      }),
    );
    const second = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Унікальний запит бета 882" }),
      }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const own = await getChat(request("/api/chat", { headers: { cookie: cookieHeader(first) } }));
    const ownBody = await own.json();
    expect(JSON.stringify(ownBody)).toContain("альфа 771");
    expect(JSON.stringify(ownBody)).not.toContain("бета 882");

    const stranger = await getChat(
      request("/api/chat", { headers: { cookie: `chat_visitor=${"a".repeat(43)}` } }),
    );
    expect((await stranger.json()).conversation).toBeNull();
  });

  it("does not call the model after a human handoff", async () => {
    process.env.CHAT_AI_API_KEY = "sk-test-secret-value";
    const fetchMock = vi.fn(async () => {
      throw new Error("model should not be called");
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Хочу поговорити з людиною" }),
      }),
    );
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.conversation.status).toBe("ai");
    expect(firstBody.conversation.messages.at(-1).body).toContain("телефон");
    expect(fetchMock).not.toHaveBeenCalled();

    const cookie = cookieHeader(first);
    const second = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ text: "Олена 0931234567" }),
      }),
    );
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.conversation.status).toBe("human");
    expect(secondBody.conversation.visitorName).toBe("Олена");
    expect(secondBody.conversation.visitorPhone).toBe("+380931234567");
    expect(fetchMock).not.toHaveBeenCalled();

    const third = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ text: "Дякую, чекаю на відповідь" }),
      }),
    );
    expect(third.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the model answer and stops calling it after a tool handoff", async () => {
    process.env.CHAT_AI_API_KEY = "sk-test-secret-value";
    let sentBody = "";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      sentBody = String(init?.body ?? "");
      return Response.json({
        choices: [
          {
            message: {
              content: "Досліджуємо ґрунти і субстрати.",
              tool_calls: [],
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const answered = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Що ви досліджуєте в ґрунті?" }),
      }),
    );
    const answeredBody = await answered.json();
    expect(answered.status).toBe(200);
    expect(answeredBody.conversation.messages.at(-1).body).toBe("Досліджуємо ґрунти і субстрати.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(sentBody);
    expect(requestBody.messages[0].content).toContain(site.email);
    expect(requestBody.messages[0].content).not.toContain("sk-test-secret-value");

    fetchMock.mockResolvedValue(
      Response.json({
        choices: [{ message: { content: null, tool_calls: [{ function: { name: "handoff" } }] } }],
      }),
    );
    const handed = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieHeader(answered) },
        body: JSON.stringify({ text: "Скільки це коштує?" }),
      }),
    );
    const handedBody = await handed.json();
    expect(handedBody.conversation.status).toBe("ai");
    expect(handedBody.conversation.messages.at(-1).body).toContain("телефон");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const followed = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: cookieHeader(answered) },
        body: JSON.stringify({ text: "Марко 0930001122" }),
      }),
    );
    expect((await followed.json()).conversation.status).toBe("human");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("staff chat", () => {
  it("rejects emails outside the allow list and delivers an operator reply", async () => {
    process.env.CHAT_OPERATOR_EMAILS = "operator@alicorn-agro.com";
    const created = await postChat(
      request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Потрібна порада щодо теплиці 441" }),
      }),
    );
    const createdBody = await created.json();
    const id = createdBody.conversation.id as string;
    const cookie = cookieHeader(created);
    const params = { params: Promise.resolve({ id }) };

    authMock.mockResolvedValue(null);
    expect((await getStaff(request("/api/staff/chat"))).status).toBe(401);

    authMock.mockResolvedValue({
      user: { email: "client@example.com", id: "user-1", organizationId: "org-1" },
    });
    expect((await getStaff(request("/api/staff/chat"))).status).toBe(403);

    authMock.mockResolvedValue({
      user: { email: "alicorn-agro@gmail.com", role: "admin", id: "admin-1", organizationId: "org-admin" },
    });
    expect((await getStaff(request("/api/staff/chat"))).status).toBe(200);

    authMock.mockResolvedValue({
      user: { email: "client@example.com", id: "user-1", organizationId: "org-1" },
    });
    expect(
      (
        await postReply(
          request(`/api/staff/chat/${id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: "Це не має зберегтися" }),
          }),
          params,
        )
      ).status,
    ).toBe(403);

    authMock.mockResolvedValue({
      user: { email: "Operator@alicorn-agro.com", id: "user-2", organizationId: "org-1" },
    });
    const reply = await postReply(
      request(`/api/staff/chat/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Добрий день, це агроном." }),
      }),
      params,
    );
    expect(reply.status).toBe(200);

    const visitor = await getChat(request("/api/chat", { headers: { cookie } }));
    const visitorBody = await visitor.json();
    expect(visitorBody.conversation.messages.some((message: { body: string }) => message.body.includes("агроном"))).toBe(
      true,
    );
    expect(visitorBody.conversation.messages.some((message: { body: string }) => message.body.includes("не має зберегтися"))).toBe(
      false,
    );

    const stranger = await getChat(
      request("/api/chat", { headers: { cookie: `chat_visitor=${"c".repeat(43)}` } }),
    );
    expect((await stranger.json()).conversation).toBeNull();
  });
});
