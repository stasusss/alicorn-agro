const BACKUP_KEY = /^backups\/alicorn-(\d{4})-(\d{2})-(\d{2})T(\d{2})\.dump\.age$/;

export const REQUIRED_BACKUP_TABLES = ["organizations", "users", "sensors", "readings"] as const;

/** UTC hour stamp used in object keys: alicorn-YYYY-MM-DDTHH.dump.age */
export function backupFileName(now = new Date()) {
  return `alicorn-${now.toISOString().slice(0, 13)}.dump.age`;
}

export function backupObjectKey(now = new Date()) {
  return `backups/${backupFileName(now)}`;
}

export function parseBackupKey(key: string): Date | null {
  const match = key.match(BACKUP_KEY);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const date = new Date(Date.UTC(year, month - 1, day, hour));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour
  ) {
    return null;
  }
  return date;
}

/**
 * Keep the newest dump of each of the last 30 distinct UTC days,
 * plus the earliest dump from the 1st of each month in the last 12 months.
 * Keys that are not backup objects are never selected for deletion.
 */
export function backupsToDelete(keys: readonly string[], now = new Date()): string[] {
  const parsed = keys
    .flatMap((key) => {
      const at = parseBackupKey(key);
      return at ? [{ key, at }] : [];
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const keep = new Set<string>();
  const seenDays = new Set<string>();
  for (const item of parsed) {
    const day = item.at.toISOString().slice(0, 10);
    if (seenDays.has(day)) continue;
    if (seenDays.size >= 30) break;
    seenDays.add(day);
    keep.add(item.key);
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const seenMonths = new Set<string>();
  const chronological = [...parsed].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const item of chronological) {
    if (item.at < monthStart) continue;
    if (item.at.getUTCDate() !== 1) continue;
    const month = item.at.toISOString().slice(0, 7);
    if (seenMonths.has(month)) continue;
    seenMonths.add(month);
    keep.add(item.key);
  }

  return parsed.filter((item) => !keep.has(item.key)).map((item) => item.key);
}

export function assertDumpListsTables(listOutput: string) {
  const missing = REQUIRED_BACKUP_TABLES.filter(
    (table) => !new RegExp(`\\bTABLE public ${table}\\b`).test(listOutput),
  );
  if (missing.length > 0) {
    throw new Error(`Backup is missing tables: ${missing.join(", ")}`);
  }
}
