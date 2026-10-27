"use client";

import {
  joinKnowledgeSections,
  knowledgeFold,
  parseKnowledgeSections,
  type KnowledgeSection,
} from "@/lib/chat/knowledge-sections";
import { FormEvent, useMemo, useState } from "react";

export function KnowledgeEditor({
  initialBody,
  initialUpdatedAt,
  generatedBody,
}: {
  initialBody: string;
  initialUpdatedAt: string | null;
  generatedBody: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);

  const sections = useMemo(() => parseKnowledgeSections(body), [body]);
  const needle = query.trim();
  const foldedNeedle = knowledgeFold(needle);
  const visible = useMemo(() => {
    if (foldedNeedle.length < 2) return sections.map((section, index) => ({ section, index, count: 0 }));
    return sections.flatMap((section, index) => {
      const count = matchCount(`${section.title}\n${section.body}`, foldedNeedle);
      return count > 0 ? [{ section, index, count }] : [];
    });
  }, [sections, foldedNeedle]);

  const selectedIndex = visible.some((item) => item.index === active) ? active : (visible[0]?.index ?? 0);
  const selected = sections[selectedIndex] ?? sections[0];

  function replaceSection(index: number, next: KnowledgeSection) {
    const copy = sections.map((section, itemIndex) => (itemIndex === index ? next : section));
    setBody(joinKnowledgeSections(copy));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/cabinet/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as { error?: string; updatedAt?: string };
      if (!response.ok) {
        setError(data.error ?? "Не вдалося зберегти.");
        return;
      }
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
      setSaved(true);
      setEditing(false);
    } catch {
      setError("Не вдалося зберегти.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cab-title">База знань</h1>
          <p className="cab-subtitle">
            Розділи зібрані з сайту Alicorn, публічних сторінок авторів Plant Empowerment і відкритих
            агрономічних джерел: Koppert для біозахисту, Держстат для середньої врожайності. Текст
            книги сюди не перенесено. Норми препаратів і правила безпеки лишаються поза текстом, який
            можна редагувати.
          </p>
        </div>
        <p className="text-[13px] text-[#86868b]">
          {updatedAt
            ? `Збережено ${new Date(updatedAt).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })}`
            : "Ще не збережено, показано початковий текст"}
        </p>
      </header>

      <label className="block">
        <span className="text-[12px] font-medium tracking-wide text-[#86868b]">Пошук</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Слово або фраза, від 2 літер"
          className="cab-input"
          aria-label="Пошук по базі знань"
        />
      </label>
      <p className="text-[13px] text-[#86868b]">
        {foldedNeedle.length < 2
          ? sectionLabel(sections.length)
          : visible.length === 0
            ? "Нічого не знайдено"
            : `${visible.length} з ${sections.length}`}
      </p>

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Розділи бази знань" className="cab-panel max-h-80 overflow-y-auto p-2 lg:max-h-[40rem]">
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-sm text-[#86868b]">Немає розділів із цим запитом.</p>
          ) : (
            <ul className="space-y-1">
              {visible.map(({ section, index, count }) => {
                const current = index === selectedIndex;
                return (
                  <li key={`${section.title}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(index);
                        setEditing(false);
                      }}
                      className={`flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] ${
                        current ? "bg-[#1d1d1f] text-white" : "hover:bg-black/[0.04]"
                      }`}
                      aria-current={current ? "true" : undefined}
                    >
                      <span>{section.title}</span>
                      {foldedNeedle.length >= 2 ? (
                        <span className={current ? "text-white/70" : "text-[#86868b]"}>{count}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {selected ? (
          <article className="cab-panel px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="cab-section-title">{selected.title}</h2>
              <button type="button" className="cab-btn-ghost" onClick={() => setEditing((value) => !value)}>
                {editing ? "Перегляд" : "Редагувати розділ"}
              </button>
            </div>
            {editing ? (
              <textarea
                value={selected.body}
                onChange={(event) =>
                  replaceSection(selectedIndex, { title: selected.title, body: event.target.value })
                }
                rows={18}
                className="cab-input mt-4 min-h-[24rem] font-mono text-[13px] leading-relaxed"
                aria-label={`Текст розділу ${selected.title}`}
              />
            ) : (
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#1d1d1f]">
                {selected.body.split("\n").map((line, index) => (
                  <p key={index} className={line.trim() ? "" : "h-2"}>
                    {line.trim() ? <Highlight text={line} query={foldedNeedle.length >= 2 ? needle : ""} /> : null}
                  </p>
                ))}
              </div>
            )}
          </article>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[#ff3b30]">{error}</p> : null}
      {saved ? <p className="text-sm text-[#1d1d1f]">Збережено.</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="cab-btn" disabled={pending}>
          {pending ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button
          type="button"
          className="cab-btn-ghost"
          onClick={() => {
            setBody(generatedBody);
            setActive(0);
            setEditing(false);
            setSaved(false);
          }}
        >
          Повернути початковий текст
        </button>
      </div>
    </form>
  );
}

function sectionLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "розділ"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "розділи"
        : "розділів";
  return `${count} ${word}`;
}

function matchCount(text: string, foldedNeedle: string) {
  const folded = knowledgeFold(text);
  let count = 0;
  let from = 0;
  while (from <= folded.length) {
    const found = folded.indexOf(foldedNeedle, from);
    if (found === -1) break;
    count += 1;
    from = found + foldedNeedle.length;
  }
  return count;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const expression = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(expression);
  return parts.map((part, index) =>
    knowledgeFold(part) === knowledgeFold(query) ? (
      <mark key={index} className="rounded bg-[#ffe08a] text-inherit">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
