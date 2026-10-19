export function assertBackupSource(databaseUrl: string) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  if (databaseUrl.startsWith("pglite:")) {
    throw new Error("Refusing to dump a local PGlite file. Point DATABASE_URL at Neon.");
  }
  let protocol = "";
  try {
    protocol = new URL(databaseUrl).protocol;
  } catch {
    throw new Error("DATABASE_URL is not a Postgres connection string");
  }
  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error("DATABASE_URL is not a Postgres connection string");
  }
}

/** True when two URLs name the same host and database, ignoring user and query. */
export function sameDatabase(a: string, b: string) {
  const left = new URL(a);
  const right = new URL(b);
  return left.host === right.host && left.pathname === right.pathname;
}

export function assertRestoreTarget(restoreUrl: string, sourceUrl: string | undefined) {
  if (!restoreUrl) throw new Error("RESTORE_DATABASE_URL is not set");
  assertBackupSource(restoreUrl);
  if (sourceUrl && sameDatabase(restoreUrl, sourceUrl)) {
    throw new Error("Refusing to restore onto DATABASE_URL. Use an empty database.");
  }
}
