import { GET } from "@/app/api/health/route";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("returns 200 without asking the database", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
