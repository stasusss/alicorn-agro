import { createHash, randomBytes } from "node:crypto";

export const CHAT_COOKIE = "chat_visitor";

export const CHAT_LIMITS = {
  messageMax: 2000,
  messagesPerHour: 20,
  conversationsPerIpPerHour: 5,
} as const;

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export function newVisitorToken() {
  return randomBytes(32).toString("base64url");
}

export function isVisitorToken(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

export function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return raw.slice(0, 64);
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const piece = part.trim();
    const index = piece.indexOf("=");
    if (index === -1) continue;
    if (piece.slice(0, index) === name) {
      return decodeURIComponent(piece.slice(index + 1));
    }
  }
  return null;
}

export function isChatOperator(email: string | null | undefined, role?: string | null) {
  if (role === "admin" || role === "staff") return true;
  if (!email) return false;
  const allowed = (process.env.CHAT_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export function safePageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const page = value.trim();
  if (!page.startsWith("/") || page.startsWith("//") || page.length > 500) return null;
  return page;
}
