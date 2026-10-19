import "dotenv/config";
import { backupDatabase } from "./backup/run";

function flag(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const invoked = process.argv[1]?.endsWith("backup-db.ts") || process.argv[1]?.endsWith("backup-db.js");

if (invoked) {
  backupDatabase({
    outDir: flag("--out"),
    skipUpload: process.argv.includes("--skip-upload"),
  })
    .then((result) => {
      console.log(
        JSON.stringify({
          msg: "backup_ok",
          objectKey: result.objectKey,
          bytes: result.bytes,
          localPath: result.localPath,
        }),
      );
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ msg: "backup_failed", error: message }));
      process.exit(1);
    });
}
