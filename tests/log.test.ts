import { logger, requestIdFrom } from "@/lib/log";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("writes one JSON line and redacts secrets", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info({
      msg: "sample",
      requestId: "req-1",
      password: "secret-pass",
      apiKey: "gw_live",
      nested: { authorization: "Bearer abc", ok: true },
      note: "Authorization: Bearer abc.def",
    });
    expect(spy).toHaveBeenCalledOnce();
    const line = String(spy.mock.calls[0]?.[0]);
    const parsed = JSON.parse(line) as { msg: string; password: string; note: string; nested: { authorization: string } };
    expect(parsed.msg).toBe("sample");
    expect(parsed.password).toBe("[redacted]");
    expect(parsed.nested.authorization).toBe("[redacted]");
    expect(line).not.toContain("secret-pass");
    expect(line).not.toContain("gw_live");
    expect(line).not.toContain("abc.def");
    expect(parsed.note).toContain("Bearer [redacted]");
  });

  it("adds the stack on errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error({ msg: "boom", err: new Error("database down") });
    const parsed = JSON.parse(String(spy.mock.calls[0]?.[0])) as { error: string; stack: string };
    expect(parsed.error).toBe("database down");
    expect(parsed.stack).toContain("database down");
  });

  it("keeps a safe request id from the header", () => {
    const request = new Request("http://localhost/api/ingest", { headers: { "x-request-id": "gw-batch.1" } });
    expect(requestIdFrom(request)).toBe("gw-batch.1");
    const noisy = new Request("http://localhost/api/ingest", { headers: { "x-request-id": "bad id\n" } });
    expect(requestIdFrom(noisy)).toMatch(/^[\da-f-]{36}$/i);
  });
});
