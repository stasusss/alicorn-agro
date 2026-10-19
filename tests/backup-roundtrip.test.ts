import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { backupDatabase, restoreDatabase } from "../scripts/backup/run";

const adminUrl = process.env.BACKUP_TEST_ADMIN_URL;

function hasBin(name: string) {
  try {
    execFileSync("which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function psql(databaseUrl: string, sql: string) {
  return execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
}

const suffix = `${process.pid}${Date.now()}`;
const sourceName = `alicorn_src_${suffix}`;
const targetName = `alicorn_dst_${suffix}`;

describe.skipIf(!adminUrl)("postgres backup roundtrip", () => {
  let workDir = "";

  afterAll(() => {
    if (!adminUrl) return;
    for (const name of [sourceName, targetName]) {
      try {
        execFileSync("psql", [adminUrl, "-c", `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`], { stdio: "ignore" });
      } catch {
        // The database may never have been created.
      }
    }
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it("restores the same number of readings into an empty database", async () => {
    for (const bin of ["psql", "pg_dump", "pg_restore", "age", "age-keygen", "gzip"]) {
      expect(hasBin(bin), bin).toBe(true);
    }

    workDir = mkdtempSync(join(tmpdir(), "alicorn-roundtrip-"));
    const identityPath = join(workDir, "identity.txt");
    execFileSync("age-keygen", ["-o", identityPath], { stdio: "ignore" });
    const recipient = readFileSync(identityPath, "utf8")
      .split("\n")
      .find((line) => line.startsWith("# public key:"))
      ?.slice("# public key:".length)
      .trim();
    expect(recipient).toMatch(/^age1/);

    psql(adminUrl!, `CREATE DATABASE ${sourceName}`);
    psql(adminUrl!, `CREATE DATABASE ${targetName}`);
    const source = new URL(adminUrl!);
    const target = new URL(adminUrl!);
    source.pathname = `/${sourceName}`;
    target.pathname = `/${targetName}`;

    const schema = `
      CREATE TABLE organizations (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        timezone text NOT NULL DEFAULT 'Europe/Kyiv',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations(id),
        email text NOT NULL,
        password_hash text NOT NULL,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE sensors (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL REFERENCES organizations(id),
        name text NOT NULL
      );
      CREATE TABLE readings (
        id uuid PRIMARY KEY,
        sensor_id uuid NOT NULL REFERENCES sensors(id) ON DELETE RESTRICT,
        organization_id uuid NOT NULL REFERENCES organizations(id),
        ts timestamptz NOT NULL,
        temperature double precision NOT NULL,
        humidity double precision NOT NULL,
        vpd double precision NOT NULL,
        dew_point double precision NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO organizations (id, name, latitude, longitude)
        VALUES ('11111111-1111-1111-1111-111111111111', 'Roundtrip', 50, 30);
      INSERT INTO users (id, organization_id, email, password_hash, name)
        VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'a@b.c', 'hash', 'A');
      INSERT INTO sensors (id, organization_id, name)
        VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'S');
      INSERT INTO readings (id, sensor_id, organization_id, ts, temperature, humidity, vpd, dew_point)
        VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '2026-10-01T00:00:00Z', 21, 60, 1, 12);
    `;
    execFileSync("psql", [source.toString(), "-v", "ON_ERROR_STOP=1"], { input: schema });

    process.env.AGE_RECIPIENT = recipient;
    process.env.AGE_IDENTITY_FILE = identityPath;
    const dumped = await backupDatabase({
      databaseUrl: source.toString(),
      outDir: join(workDir, "out"),
      skipUpload: true,
      now: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(dumped.localPath).toBeTruthy();
    expect(dumped.bytes).toBeGreaterThan(0);

    await restoreDatabase({
      file: dumped.localPath!,
      restoreUrl: target.toString(),
      sourceUrl: source.toString(),
    });

    expect(psql(target.toString(), "SELECT count(*) FROM readings")).toContain("1");
    expect(() => psql(target.toString(), "DELETE FROM sensors")).toThrow();
  });
});
