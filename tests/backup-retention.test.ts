import { assertDumpListsTables, backupFileName, backupsToDelete, githubReleaseAssetId, parseBackupKey } from "@/lib/backup/retention";
import { assertBackupSource, assertRestoreTarget, sameDatabase } from "@/lib/backup/safety";
import { describe, expect, it } from "vitest";

function key(stamp: string) {
  return `backups/alicorn-${stamp}.dump.age`;
}

describe("backup retention", () => {
  const now = new Date("2026-10-19T12:00:00.000Z");

  it("names dumps by UTC hour and ignores malformed keys", () => {
    expect(backupFileName(new Date("2026-10-19T15:04:05.000Z"))).toBe("alicorn-2026-10-19T15.dump.age");
    expect(parseBackupKey(key("2026-10-19T15"))?.toISOString()).toBe("2026-10-19T15:00:00.000Z");
    expect(parseBackupKey(key("2026-02-31T00"))).toBeNull();
    expect(parseBackupKey("backups/other.dump.age")).toBeNull();
    expect(githubReleaseAssetId("https://api.github.com/repos/acme/app/releases/assets/678825083")).toBe("678825083");
    expect(() => githubReleaseAssetId("RA_kwDOVP1rS84odgx7")).toThrow(/asset id/);
  });

  it("keeps 30 daily dumps and the first dump of each recent month", () => {
    const keys = ["notes/unrelated.txt"];
    for (let day = 1; day <= 19; day++) {
      const stamp = `2026-10-${String(day).padStart(2, "0")}T02`;
      keys.push(key(stamp));
    }
    for (let day = 1; day <= 30; day++) {
      keys.push(key(`2026-09-${String(day).padStart(2, "0")}T02`));
    }
    keys.push(key("2026-10-01T00"), key("2026-10-01T15"));
    keys.push(key("2025-11-01T00"));
    keys.push(key("2025-10-01T00"));

    const doomed = new Set(backupsToDelete(keys, now));
    expect(doomed.has("notes/unrelated.txt")).toBe(false);
    expect(doomed.has(key("2026-10-19T02"))).toBe(false);
    expect(doomed.has(key("2026-09-20T02"))).toBe(false);
    expect(doomed.has(key("2026-09-19T02"))).toBe(true);
    expect(doomed.has(key("2026-10-01T15"))).toBe(false);
    expect(doomed.has(key("2026-10-01T00"))).toBe(false);
    expect(doomed.has(key("2025-11-01T00"))).toBe(false);
    expect(doomed.has(key("2025-10-01T00"))).toBe(true);
  });

  it("requires the client tables in a dump listing", () => {
    const list = ["organizations", "users", "sensors", "readings"]
      .map((table) => `200; 1259 1 TABLE public ${table} postgres`)
      .join("\n");
    expect(() => assertDumpListsTables(list)).not.toThrow();
    expect(() => assertDumpListsTables("TABLE public organizations")).toThrow(/readings/);
  });
});

describe("backup safety", () => {
  it("refuses PGlite and a restore onto the source database", () => {
    expect(() => assertBackupSource("pglite:./.data/pglite")).toThrow(/PGlite/);
    expect(() => assertBackupSource("")).toThrow(/not set/);
    const source = "postgresql://user:secret@db.example/alicorn";
    const same = "postgresql://other:other@db.example/alicorn?sslmode=require";
    const other = "postgresql://user:secret@db.example/alicorn_restore";
    expect(sameDatabase(source, same)).toBe(true);
    expect(() => assertRestoreTarget(same, source)).toThrow(/Refusing to restore/);
    expect(() => assertRestoreTarget(other, source)).not.toThrow();
  });
});
