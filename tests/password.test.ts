import { hashApiKey, hashPassword, verifyApiKey, verifyPassword } from "@/lib/password";
import { describe, expect, it } from "vitest";

describe("password and gateway key hashes", () => {
  it("verifies a matching secret and rejects a different one", async () => {
    const passwordHash = await hashPassword("correct-horse");
    expect(await verifyPassword("correct-horse", passwordHash)).toBe(true);
    expect(await verifyPassword("wrong", passwordHash)).toBe(false);

    const keyHash = hashApiKey("gw_live_key");
    expect(verifyApiKey("gw_live_key", keyHash)).toBe(true);
    expect(verifyApiKey("gw_other", keyHash)).toBe(false);
    expect(keyHash).not.toContain("gw_live_key");
  });
});
