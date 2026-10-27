"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StaffConversation = {
  id: string;
  status: "ai" | "human" | "closed";
  visitorName: string | null;
  visitorPhone: string | null;
  pageUrl: string | null;
  lastMessageAt: string;
  preview: string;
};

type ChatMessage = {
  id: string;
  role: "visitor" | "assistant" | "staff";
  body: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  status: "ai" | "human" | "closed";
  visitorName: string | null;
  visitorPhone: string | null;
  messages: ChatMessage[];
};

const statusLabel = {
  ai: "AI",
  human: "Спеціаліст",
  closed: "Закрито",
} as const;

export function ChatInbox() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("id");
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const openConversation = conversation?.id === selectedId ? conversation : null;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const loadList = useCallback(async () => {
    const response = await fetch("/api/staff/chat");
    if (!response.ok) return;
    const data = (await response.json()) as { conversations: StaffConversation[] };
    setConversations(data.conversations);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const response = await fetch(`/api/staff/chat/${id}`);
    if (!response.ok) {
      setConversation(null);
      return;
    }
    const data = (await response.json()) as { conversation: Conversation };
    setConversation(data.conversation);
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => void loadList(), 0);
    const timer = window.setInterval(() => void loadList(), 3000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    const kick = window.setTimeout(() => void loadConversation(selectedId), 0);
    const timer = window.setInterval(() => void loadConversation(selectedId), 3000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [selectedId, loadConversation]);

  function select(id: string) {
    router.replace(`/cabinet/chats?id=${id}`);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || pending || text.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/chat/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as { conversation?: Conversation; error?: string };
      if (!response.ok || !data.conversation) {
        setError(data.error ?? "Не вдалося надіслати відповідь.");
        return;
      }
      setConversation(data.conversation);
      setText("");
      void loadList();
    } catch {
      setError("Не вдалося надіслати відповідь.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:h-dvh">
      <h1 className="font-display text-2xl text-forest-dark">Звернення з сайту</h1>
      <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <ul className="max-h-72 space-y-2 overflow-y-auto lg:max-h-none">
          {conversations.length === 0 ? (
            <li className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-muted">Поки немає звернень.</li>
          ) : (
            conversations.map((item) => {
              const active = item.id === selectedId;
              const title = item.visitorName || "Відвідувач";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => select(item.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left ${
                      active ? "bg-mint" : "bg-white hover:bg-mint/60"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-forest-dark">{title}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-forest">
                        {statusLabel[item.status]}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-muted">{item.preview}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <section className="flex min-h-[28rem] flex-col rounded-3xl border border-forest/10 bg-white">
          {openConversation ? (
            <>
              <div className="border-b border-forest/10 px-4 py-3">
                <p className="font-medium text-forest-dark">
                  {openConversation.visitorName || "Відвідувач"}
                </p>
                <p className="text-xs text-ink-muted">
                  {[openConversation.visitorPhone || "Телефон ще не вказано", selected?.pageUrl]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {openConversation.messages.map((message) => (
                  <p
                    key={message.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      message.role === "staff"
                        ? "ml-auto bg-forest text-white"
                        : "bg-cream text-ink"
                    }`}
                  >
                    {message.body}
                  </p>
                ))}
              </div>
              <form onSubmit={onSubmit} className="border-t border-forest/10 p-3">
                {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
                <div className="flex items-end gap-2">
                  <label className="sr-only" htmlFor="staff-reply">
                    Відповідь
                  </label>
                  <textarea
                    id="staff-reply"
                    rows={2}
                    value={text}
                    maxLength={2000}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Відповідь клієнту"
                    className="min-h-11 flex-1 resize-none rounded-2xl border border-forest/15 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-4 focus:ring-forest/10"
                  />
                  <button
                    type="submit"
                    disabled={pending || text.trim().length === 0}
                    className="rounded-full bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
                  >
                    Надіслати
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="m-auto px-6 text-sm text-ink-muted">Оберіть діалог зі списку.</p>
          )}
        </section>
      </div>
    </div>
  );
}
