import { Logo } from "@/components/logo";
import { navItems, site } from "@/lib/site";
import { Mail, Phone } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-forest-deeper text-cream">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-16">
        <div className="lg:col-span-5">
          <Logo inverted />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/70">
            Alicorn Agro — ваш надійний партнер у світі розумного землеробства.
            Інженерна точність зустрічається з фізіологією рослин.
          </p>
        </div>

        <div className="lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wheat">
            Навігація
          </p>
          <ul className="mt-4 space-y-2.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-cream/80 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wheat">
            Контакти
          </p>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href={site.phoneHref}
                className="inline-flex items-center gap-2.5 text-sm text-cream/80 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 text-wheat" aria-hidden />
                {site.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${site.email}`}
                className="inline-flex items-center gap-2.5 text-sm text-cream/80 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-wheat" aria-hidden />
                {site.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-cream/50 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} Alicorn Agro. Усі права захищені.
        </p>
      </div>
    </footer>
  );
}
