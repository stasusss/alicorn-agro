import "dotenv/config";
import { downloadBackup, restoreDatabase } from "./backup/run";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function flag(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const objectKey = flag("--r2-key");
  let file = flag("--file");
  let tempDir: string | null = null;
  if (!file && objectKey) {
    tempDir = await mkdtemp(join(tmpdir(), "alicorn-download-"));
    file = join(tempDir, "dump.age");
    await downloadBackup(objectKey, file);
  }
  if (!file) {
    throw new Error("Pass --file <dump.age> or --r2-key backups/alicorn-....dump.age");
  }
  try {
    await restoreDatabase({ file });
    console.log(JSON.stringify({ msg: "restore_ok", file }));
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

const invoked = process.argv[1]?.endsWith("restore-db.ts") || process.argv[1]?.endsWith("restore-db.js");

if (invoked) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ msg: "restore_failed", error: message }));
    process.exit(1);
  });
}
