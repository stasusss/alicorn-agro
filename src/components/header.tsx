"use client";

import { ConsultButton } from "@/components/consult-button";
import { Logo } from "@/components/logo";
import { navItems } from "@/lib/site";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-forest/10 bg-cream/95 backdrop-blur-xl"
          : "border-b border-transparent bg-cream/70 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6 lg:h-[4.75rem] lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Головна навігація">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.03] ${
                  active
                    ? "bg-mint text-forest-dark"
                    : "text-ink-muted hover:bg-mint/70 hover:text-forest-dark"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <ConsultButton className="px-5 py-2.5 text-[0.8125rem]" />
        </div>

        <button
          type="button"
          className="rounded-full p-2 text-forest-dark transition-colors hover:bg-mint lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Закрити меню" : "Відкрити меню"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="border-t border-forest/10 bg-cream px-4 py-4 lg:hidden"
            aria-label="Мобільна навігація"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item, index) => {
                const active = pathname === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-2xl px-4 py-3 text-base font-medium transition-colors ${
                        active ? "bg-mint text-forest-dark" : "text-ink hover:bg-mint/60"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
              <ConsultButton className="mt-3 w-full" onClick={() => setOpen(false)} />
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
