"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "visitor" | "assistant" | "staff";
  body: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  status: "ai" | "human" | "closed";
  messages: ChatMessage[];
};

const suggestions = [
  "Які послуги ви надаєте?",
  "Розкажіть про ClimateGuard",
  "Зв’язатися зі спеціалістом",
];

export function ChatWidget() {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/chat");
    if (!response.ok) return;
    const data = (await response.json()) as { conversation: Conversation | null };
    setConversation(data.conversation);
  }, []);

  useEffect(() => {
    if (!open) return;
    const kick = window.setTimeout(() => void load(), 0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(kick);
      document.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(frame);
    };
  }, [open, load]);

  useEffect(() => {
    if (!open || conversation?.status !== "human") return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [open, conversation?.status, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages.length, open, pending]);

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    setText("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, pageUrl: window.location.pathname }),
      });
      const data = (await response.json()) as { conversation?: Conversation; error?: string };
      if (!response.ok || !data.conversation) {
        setError(data.error ?? "Не вдалося надіслати повідомлення.");
        setText(trimmed);
        return;
      }
      setConversation(data.conversation);
    } catch {
      setError("Не вдалося надіслати повідомлення.");
      setText(trimmed);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(text);
  }

  const waitingForStaff =
    conversation?.status === "human" &&
    !conversation.messages.some((message) => message.role === "staff");

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.section
            role="dialog"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 top-20 z-20 flex flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream shadow-2xl bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:top-auto sm:right-4 sm:bottom-24 sm:left-auto sm:h-[min(32rem,calc(100dvh-11rem))] sm:w-[23.5rem]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-forest/10 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-forest">
                  Alicorn Agro
                </p>
                <h2 id={titleId} className="font-display text-base text-forest-dark">
                  Чат
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink"
                aria-label="Закрити чат"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <p className="rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-ink">
                Вітаємо в Alicorn Agro. Запитайте про послуги, дослідження ґрунтів або систему
                моніторингу мікроклімату.
              </p>
              {conversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "visitor"
                      ? "ml-auto bg-forest text-white"
                      : "bg-white text-ink"
                  }`}
                >
                  {message.role === "staff" ? (
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                      Спеціаліст
                    </span>
                  ) : null}
                  {message.body}
                </div>
              ))}
              {pending ? <p className="text-xs text-ink-muted">Пишемо відповідь…</p> : null}
              {waitingForStaff ? (
                <p className="text-xs font-medium text-forest">Спеціаліст підключиться</p>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {conversation?.messages.length ? null : (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={pending}
                    onClick={() => void send(suggestion)}
                    className="rounded-full bg-mint px-3 py-1.5 text-left text-xs font-medium text-forest-dark transition-colors hover:bg-white disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={onSubmit} className="border-t border-forest/10 p-3">
              {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="chat-message">
                  Повідомлення
                </label>
                <textarea
                  id="chat-message"
                  ref={inputRef}
                  rows={2}
                  value={text}
                  maxLength={2000}
                  placeholder="Напишіть повідомлення"
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send(text);
                    }
                  }}
                  className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-forest/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
                />
                <button
                  type="submit"
                  disabled={pending || text.trim().length === 0}
                  className="rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
                >
                  Надіслати
                </button>
              </div>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white shadow-[0_12px_28px_-12px_rgba(31,92,56,0.7)] transition-colors hover:bg-forest-mid"
        aria-label={open ? "Закрити чат" : "Відкрити чат"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
