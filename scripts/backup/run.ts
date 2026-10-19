import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assertDumpListsTables, backupObjectKey, backupsToDelete } from "../../src/lib/backup/retention";
import { assertBackupSource, assertRestoreTarget } from "../../src/lib/backup/safety";
import { run, runToFile } from "./exec";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const GITHUB_BACKUP_TAG = "db-backups";

function githubBackupRepo() {
  return process.env.BACKUP_GITHUB_REPO?.trim() ?? "";
}

function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2Client(config: R2Config) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function gzipFile(source: string, destination: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("gzip", ["-c", source], { stdio: ["ignore", "pipe", "pipe"] });
    const out = createWriteStream(destination);
    let stderr = "";
    let settled = false;
    let exitCode: number | null = null;
    let finished = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    const tryDone = () => {
      if (exitCode === null || !finished) return;
      if (exitCode !== 0) done(new Error(`gzip failed (${exitCode}): ${stderr.slice(0, 500)}`));
      else done();
    };
    child.stdout.pipe(out);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", done);
    out.on("error", done);
    child.on("close", (code) => {
      exitCode = code ?? 1;
      tryDone();
    });
    out.on("finish", () => {
      finished = true;
      tryDone();
    });
  });
}

async function listBackupKeys(client: S3Client, bucket: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "backups/",
        ContinuationToken: token,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (item.Key) keys.push(item.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function uploadGithubBackup(repo: string, agePath: string, now: Date) {
  const exists = await run("gh", ["release", "view", GITHUB_BACKUP_TAG, "--repo", repo]).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await run("gh", [
      "release",
      "create",
      GITHUB_BACKUP_TAG,
      "--repo",
      repo,
      "--title",
      "Database backups",
      "--notes",
      "Encrypted pg_dump files. The age identity is not in this repository.",
    ]);
  }
  await run("gh", ["release", "upload", GITHUB_BACKUP_TAG, agePath, "--repo", repo, "--clobber"]);

  const view = await run("gh", [
    "release",
    "view",
    GITHUB_BACKUP_TAG,
    "--repo",
    repo,
    "--json",
    "assets",
  ]);
  const assets = (JSON.parse(view) as { assets?: { id: number; name: string }[] }).assets ?? [];
  const doomed = new Set(backupsToDelete(assets.map((asset) => `backups/${asset.name}`), now));
  for (const asset of assets) {
    if (!doomed.has(`backups/${asset.name}`)) continue;
    await run("gh", ["api", "--method", "DELETE", `repos/${repo}/releases/assets/${asset.id}`]);
  }
}

export async function applyBackupRetention(now = new Date()) {
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured");
  const client = r2Client(config);
  const keys = await listBackupKeys(client, config.bucket);
  const doomed = backupsToDelete(keys, now);
  for (let i = 0; i < doomed.length; i += 1000) {
    const batch = doomed.slice(i, i + 1000);
    if (batch.length === 0) continue;
    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
  }
  return { kept: keys.length - doomed.length, deleted: doomed.length };
}

export type BackupResult = {
  fileName: string;
  objectKey: string;
  localPath: string | null;
  bytes: number;
};

export async function backupDatabase(opts?: {
  databaseUrl?: string;
  outDir?: string;
  skipUpload?: boolean;
  now?: Date;
}): Promise<BackupResult> {
  const databaseUrl = opts?.databaseUrl ?? process.env.DATABASE_URL ?? "";
  assertBackupSource(databaseUrl);
  const recipient = process.env.AGE_RECIPIENT ?? "";
  if (!recipient) throw new Error("AGE_RECIPIENT is not set");

  const requireUpload = process.env.REQUIRE_UPLOAD === "1";
  const config = r2Config();
  const githubRepo = githubBackupRepo();
  if (opts?.skipUpload && !opts?.outDir) {
    throw new Error("Pass --out when using --skip-upload");
  }
  if (requireUpload && !config && !githubRepo) {
    throw new Error("Set R2 credentials or BACKUP_GITHUB_REPO");
  }
  if (!opts?.skipUpload && !config && !githubRepo && !opts?.outDir) {
    throw new Error("Set R2 credentials, BACKUP_GITHUB_REPO, or pass --out");
  }

  const now = opts?.now ?? new Date();
  const fileName = backupObjectKey(now).slice("backups/".length);
  const dir = await mkdtemp(join(tmpdir(), "alicorn-backup-"));
  const customPath = join(dir, "dump.custom");
  const gzipPath = join(dir, "dump.custom.gz");
  const agePath = join(dir, fileName);

  try {
    await run(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", customPath, databaseUrl],
      { redact: [databaseUrl] },
    );
    const dumped = await stat(customPath);
    if (dumped.size <= 0) throw new Error("pg_dump wrote an empty file");

    const list = await run("pg_restore", ["--list", customPath]);
    assertDumpListsTables(list);

    await gzipFile(customPath, gzipPath);
    await run("age", ["-r", recipient, "-o", agePath, gzipPath]);
    const encrypted = await stat(agePath);
    if (encrypted.size <= 0) throw new Error("age wrote an empty file");

    let localPath: string | null = null;
    if (opts?.outDir) {
      await mkdir(opts.outDir, { recursive: true });
      localPath = join(opts.outDir, fileName);
      await copyFile(agePath, localPath);
    }

    let uploaded = false;
    if (!opts?.skipUpload && config) {
      const client = r2Client(config);
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: `backups/${fileName}`,
          Body: createReadStream(agePath),
          ContentType: "application/octet-stream",
        }),
      );
      await applyBackupRetention(now);
      uploaded = true;
    }
    if (!opts?.skipUpload && githubRepo) {
      await uploadGithubBackup(githubRepo, agePath, now);
      uploaded = true;
    }
    if (requireUpload && !uploaded) {
      throw new Error("Backup upload did not run");
    }

    return {
      fileName,
      objectKey: `backups/${fileName}`,
      localPath,
      bytes: encrypted.size,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function identityFile(): Promise<{ path: string; temporaryDir: string | null }> {
  if (process.env.AGE_IDENTITY_FILE) {
    return { path: process.env.AGE_IDENTITY_FILE, temporaryDir: null };
  }
  const secret = process.env.AGE_IDENTITY ?? "";
  if (!secret) throw new Error("Set AGE_IDENTITY_FILE or AGE_IDENTITY");
  const dir = await mkdtemp(join(tmpdir(), "alicorn-age-"));
  const path = join(dir, "identity.txt");
  await writeFile(path, secret.endsWith("\n") ? secret : `${secret}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return { path, temporaryDir: dir };
}

export async function downloadBackup(objectKey: string, destination: string) {
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured");
  const client = r2Client(config);
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  if (!object.Body) throw new Error(`Empty object ${objectKey}`);
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  await writeFile(destination, bytes);
}

export async function restoreDatabase(opts: { file: string; restoreUrl?: string; sourceUrl?: string }) {
  const restoreUrl = opts.restoreUrl ?? process.env.RESTORE_DATABASE_URL ?? "";
  const sourceUrl = opts.sourceUrl ?? process.env.DATABASE_URL;
  assertRestoreTarget(restoreUrl, sourceUrl);

  const identity = await identityFile();
  const dir = await mkdtemp(join(tmpdir(), "alicorn-restore-"));
  const gzipPath = join(dir, "dump.custom.gz");
  const customPath = join(dir, "dump.custom");
  try {
    await run("age", ["-d", "-i", identity.path, "-o", gzipPath, opts.file], {
      redact: [restoreUrl],
    });
    await runToFile("gzip", ["-dc", gzipPath], customPath, [restoreUrl]);
    const restored = await stat(customPath);
    if (restored.size <= 0) throw new Error("Decrypted dump is empty");
    const list = await run("pg_restore", ["--list", customPath]);
    assertDumpListsTables(list);
    await run(
      "pg_restore",
      ["--no-owner", "--no-acl", "--clean", "--if-exists", "--exit-on-error", "--dbname", restoreUrl, customPath],
      { redact: [restoreUrl, sourceUrl ?? ""] },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    if (identity.temporaryDir) await rm(identity.temporaryDir, { recursive: true, force: true });
  }
}
