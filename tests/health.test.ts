import { GET } from "@/app/api/health/route";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  getDb: getDbMock,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns 200 when the database responds", async () => {
    getDbMock.mockResolvedValue({
      execute: vi.fn().mockResolvedValue(undefined),
    });
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when the database is down", async () => {
    getDbMock.mockRejectedValue(new Error("connection refused"));
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
