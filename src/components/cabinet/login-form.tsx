"use client";

import { loginAction } from "@/lib/actions/auth";
import { useState, useTransition } from "react";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await loginAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label className="block text-[13px] text-[#86868b]">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="cab-input"
        />
      </label>
      <label className="block text-[13px] text-[#86868b]">
        Пароль
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="cab-input"
        />
      </label>
      {error && <p className="text-[13px] text-[#ff3b30]">{error}</p>}
      <button type="submit" disabled={pending} className="cab-btn mt-2 w-full">
        {pending ? "Вхід…" : "Увійти"}
      </button>
    </form>
  );
}
