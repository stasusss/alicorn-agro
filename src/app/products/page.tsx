import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Продукція",
};

export default function ProductsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
        Продукція
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-forest-dark">
        Сторінка готується
      </h1>
      <p className="mt-4 text-ink-muted">
        Опис системи ClimateGuard з’явиться на наступному кроці розробки.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex text-sm font-semibold text-forest hover:text-forest-mid"
      >
        ← Повернутися на головну
      </Link>
    </section>
  );
}
