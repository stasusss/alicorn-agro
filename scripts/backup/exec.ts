import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

export function run(
  command: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv; redact?: string[] },
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...opts?.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      let message = stderr || stdout;
      for (const secret of opts?.redact ?? []) {
        if (secret) message = message.split(secret).join("[redacted]");
      }
      reject(new Error(`${command} failed (${code}): ${message.slice(0, 2000)}`));
    });
  });
}

export function runToFile(command: string, args: string[], filePath: string, redact: string[] = []) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out = createWriteStream(filePath);
    let stderr = "";
    let settled = false;
    let exitCode: number | null = null;
    let finished = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const tryDone = () => {
      if (exitCode === null || !finished) return;
      if (exitCode !== 0) {
        let message = stderr;
        for (const secret of redact) {
          if (secret) message = message.split(secret).join("[redacted]");
        }
        fail(`${command} failed (${exitCode}): ${message.slice(0, 2000)}`);
        return;
      }
      succeed();
    };
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.stdout.pipe(out);
    child.on("error", (err) => fail(err.message));
    out.on("error", (err) => fail(err.message));
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
