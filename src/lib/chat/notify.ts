import { deliverOperatorNotice } from "@/lib/alerts";
import { logger } from "@/lib/log";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function appUrl() {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://alicorn-agro-rho.vercel.app"
  ).replace(/\/$/, "");
}

export async function notifyLead(input: {
  name: string;
  phone: string;
  email: string;
  time: string;
  notes: string;
}) {
  const link = `${appUrl()}/cabinet`;
  const subject = "Нова заявка на консультацію";
  const text = `${subject}\n${input.name}, ${input.phone}\n${input.email}\nЗручний час: ${input.time}\n${input.notes}\n\n${link}`.trim();
  const telegramText = `<b>${escapeHtml(subject)}</b>\n${escapeHtml(input.name)}, ${escapeHtml(input.phone)}\n${escapeHtml(input.email)}\nЗручний час: ${escapeHtml(input.time)}\n${escapeHtml(input.notes)}\n\n<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;
  try {
    await deliverOperatorNotice({ subject, text, telegramText });
  } catch (err) {
    logger.error({ msg: "lead_notify_failed", err });
  }
}
export async function notifyOperators(input: {
  conversationId: string;
  kind: "handoff" | "message";
  visitorName: string | null;
  visitorPhone: string | null;
  text: string;
}) {
  const link = `${appUrl()}/cabinet/chats?id=${input.conversationId}`;
  const who = [input.visitorName, input.visitorPhone].filter(Boolean).join(", ") || "відвідувач";
  const subject = input.kind === "handoff" ? "Нове звернення в чаті сайту" : "Нове повідомлення в чаті сайту";
  const excerpt = input.text.slice(0, 500);
  const text = `${subject}\n${who}\n\n${excerpt}\n\n${link}`;
  const telegramText = `<b>${escapeHtml(subject)}</b>\n${escapeHtml(who)}\n\n${escapeHtml(excerpt)}\n\n<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`;

  try {
    await deliverOperatorNotice({ subject, text, telegramText });
  } catch (err) {
    logger.error({ msg: "chat_notify_failed", err, conversationId: input.conversationId });
  }
}
