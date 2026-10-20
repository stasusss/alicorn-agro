import { LoginForm } from "@/components/cabinet/login-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Вхід",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="cabinet flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/[0.06] bg-[#f5f5f7]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-[#1d1d1f]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={32} height={34} className="h-8 w-auto" />
            Alicorn
          </Link>
          <Link href="/" className="cab-link">
            На сайт
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <h1 className="cab-title text-center" style={{ fontSize: "2rem" }}>
          Особистий кабінет
        </h1>
        <p className="cab-subtitle text-center">
          Увійдіть, щоб переглянути дані з датчиків.
        </p>

        <div className="cab-panel mt-10 p-6 sm:p-8">
          {params.error && (
            <p className="mb-4 rounded-xl bg-[#ff3b30]/08 px-3 py-2 text-[13px] text-[#ff3b30]">
              Невірний email або пароль.
            </p>
          )}
          <LoginForm callbackUrl={params.callbackUrl ?? "/cabinet"} />
        </div>
      </div>
    </div>
  );
}
