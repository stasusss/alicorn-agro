"use client";

import { logoutAction } from "@/lib/actions/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/cabinet", label: "Огляд" },
  { href: "/cabinet/charts", label: "Графіки" },
  { href: "/cabinet/alerts", label: "Алерти" },
  { href: "/cabinet/export", label: "Звіти" },
];

export function CabinetNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f5f5f7]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/cabinet"
          className="shrink-0 text-[15px] font-semibold tracking-tight text-[#1d1d1f]"
        >
          Alicorn
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto sm:gap-5">
          {links.map((link) => {
            const active =
              link.href === "/cabinet"
                ? pathname === "/cabinet"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap px-2 py-1 text-[12px] tracking-wide transition sm:text-[13px] ${
                  active
                    ? "font-medium text-[#1d1d1f]"
                    : "text-[#1d1d1f]/55 hover:text-[#1d1d1f]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <form action={logoutAction} className="shrink-0">
          <button
            type="submit"
            className="cab-link"
            title={userEmail}
          >
            Вийти
          </button>
        </form>
      </div>
    </header>
  );
}
