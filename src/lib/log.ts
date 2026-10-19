const SENSITIVE_KEY = /authorization|api[_-]?key|password|secret|token|cookie|credential/i;

type Level = "info" | "warn" | "error";

export type LogFields = {
  msg: string;
  requestId?: string | null;
  err?: unknown;
  [key: string]: unknown;
};

function redact(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    if (/bearer\s+(?!token\b)\S+/i.test(value)) {
      return value.replace(/bearer\s+(?!token\b)\S+/gi, "Bearer [redacted]");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value)) {
      out[childKey] = redact(child, childKey);
    }
    return out;
  }
  return value;
}

function write(level: Level, fields: LogFields) {
  const { err, ...rest } = fields;
  const payload: Record<string, unknown> = {
    level,
    at: new Date().toISOString(),
    ...(redact(rest) as Record<string, unknown>),
  };
  if (err !== undefined) {
    const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : "unknown error");
    payload.error = redact(error.message);
    payload.stack = error.stack;
  }
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info(fields: LogFields) {
    write("info", fields);
  },
  warn(fields: LogFields) {
    write("warn", fields);
  },
  error(fields: LogFields) {
    write("error", fields);
  },
};

export function requestIdFrom(request: Request) {
  const header = request.headers.get("x-request-id")?.trim() ?? "";
  if (header.length > 0 && header.length <= 128 && /^[\w.-]+$/.test(header)) return header;
  return crypto.randomUUID();
}
