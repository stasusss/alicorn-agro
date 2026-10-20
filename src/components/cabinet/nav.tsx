"use client";

import { logoutAction } from "@/lib/actions/auth";
import { Bell, ChartLine, FileText, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/cabinet", label: "Огляд", icon: LayoutGrid },
  { href: "/cabinet/charts", label: "Графіки", icon: ChartLine },
  { href: "/cabinet/alerts", label: "Сповіщення", icon: Bell },
  { href: "/cabinet/export", label: "Звіти", icon: FileText },
];

export function CabinetNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#f5f5f7]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link
            href="/cabinet"
            className="inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-[#1d1d1f]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" width={32} height={34} className="h-8 w-auto" />
            Alicorn
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center sm:flex"
            aria-label="Розділи кабінету"
          >
            <div className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-black/[0.05] p-1">
              {links.map((link) => {
                const active = isActive(pathname, link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] tracking-wide transition ${
                      active
                        ? "bg-white font-medium text-[#1d1d1f] shadow-sm"
                        : "text-[#1d1d1f]/55 hover:bg-white/70 hover:text-[#1d1d1f]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <form action={logoutAction} className="shrink-0">
            <button type="submit" className="cab-link inline-flex min-h-11 items-center px-1" title={userEmail}>
              Вийти
            </button>
          </form>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-[#f5f5f7]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
        aria-label="Розділи кабінету"
      >
        <div className="grid grid-cols-4">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`mx-1 my-1.5 flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] leading-none ${
                  active
                    ? "bg-white font-medium text-[#1d1d1f] shadow-sm"
                    : "text-[#86868b]"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/cabinet" ? pathname === "/cabinet" : pathname.startsWith(href);
}
