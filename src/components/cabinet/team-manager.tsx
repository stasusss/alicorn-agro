"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; name: string; email: string };

export function TeamManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/cabinet/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Не вдалося додати працівника.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Не вдалося додати працівника.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="cab-title">Команда</h1>
        <p className="cab-subtitle">
          Працівник бачить базу знань і сам бере нові чати. Чужі діалоги, статистику клієнтів і
          виміри він не бачить.
        </p>
      </header>

      <form onSubmit={onSubmit} className="cab-panel max-w-lg space-y-4 p-5">
        <label className="block text-[13px] text-[#86868b]">
          Ім’я
          <input name="name" required minLength={2} className="cab-input" autoComplete="off" />
        </label>
        <label className="block text-[13px] text-[#86868b]">
          Email
          <input name="email" type="email" required className="cab-input" autoComplete="off" />
        </label>
        <label className="block text-[13px] text-[#86868b]">
          Пароль
          <input
            name="password"
            type="text"
            required
            minLength={8}
            className="cab-input"
            autoComplete="new-password"
          />
        </label>
        {error ? <p className="text-sm text-[#ff3b30]">{error}</p> : null}
        <button type="submit" className="cab-btn" disabled={pending}>
          {pending ? "Додаємо…" : "Додати працівника"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="cab-section-title">Працівники</h2>
        {members.length === 0 ? (
          <p className="cab-panel px-4 py-3 text-sm text-[#86868b]">Поки нікого не додано.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id} className="cab-panel px-4 py-3 text-sm">
                <p className="font-medium">{member.name}</p>
                <p className="text-[#86868b]">{member.email}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
