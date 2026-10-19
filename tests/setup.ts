import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const globalForDb = globalThis as {
  __alicornDb?: unknown;
  __alicornDbPromise?: unknown;
};

delete globalForDb.__alicornDb;
delete globalForDb.__alicornDbPromise;

const dir = mkdtempSync(join(tmpdir(), "alicorn-vitest-"));
process.env.DATABASE_URL = `pglite:${join(dir, "db")}`;
process.env.AUTH_SECRET ??= "test-auth-secret";
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.RESEND_API_KEY;
delete process.env.AGE_RECIPIENT;
delete process.env.AGE_IDENTITY;
delete process.env.REQUIRE_UPLOAD;
