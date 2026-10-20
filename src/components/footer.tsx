import { Logo } from "@/components/logo";
import { navItems, site } from "@/lib/site";
import { Mail, Phone } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-forest-deeper text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-14 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-16">
        <div className="lg:col-span-5">
          <Logo variant="lockup" tone="light" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/70">
            Alicorn Agro — ваш надійний партнер у світі розумного землеробства.
            Інженерна точність зустрічається з фізіологією рослин.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:gap-10 lg:col-span-7 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wheat">
            Навігація
          </p>
          <ul className="mt-4 space-y-2.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-10 items-center text-sm text-cream/80 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wheat">
            Контакти
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href={site.phoneHref}
                className="inline-flex items-start gap-2.5 text-sm text-cream/80 transition-colors hover:text-white"
              >
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-wheat" aria-hidden />
                {site.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="inline-flex items-start gap-2.5 break-all text-sm text-cream/80 transition-colors hover:text-white"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-wheat" aria-hidden />
                {site.email}
              </a>
            </li>
          </ul>
        </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-cream/50 sm:px-6 lg:px-8">
          © 2026 Alicorn Agro. Усі права захищені.
        </p>
      </div>
    </footer>
  );
}
