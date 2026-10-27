import { POST } from "@/app/api/leads/route";
import { beforeEach, describe, expect, it } from "vitest";

let ip = 40;

beforeEach(() => {
  ip += 1;
  delete process.env.RESEND_API_KEY;
  delete process.env.CHAT_TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_CHAT_ID;
});

describe("consultation leads", () => {
  it("stores a valid request and rejects a short phone", async () => {
    const headers = { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${ip}` };
    const missing = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "І",
          phone: "123",
          email: "not-an-email",
          time: "",
        }),
      }),
    );
    expect(missing.status).toBe(400);

    const created = await POST(
      new Request("http://localhost/api/leads", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Олена Коваль",
          phone: "+380931112233",
          email: "olena@example.com",
          time: "Завтра після 15:00",
          notes: "Теплиця 400 м²",
        }),
      }),
    );
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ ok: true });
  });
});
