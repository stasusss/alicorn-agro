"use client";

import { Reveal } from "@/components/reveal";
import { aboutExpertise, aboutValues } from "@/lib/site";
import {
  Apple,
  Crosshair,
  Factory,
  Flower2,
  GraduationCap,
  LandPlot,
  Sprout,
  Wrench,
} from "lucide-react";

const expertiseIcons = [Factory, Apple, Flower2, LandPlot];
const valueIcons = [Crosshair, Wrench, GraduationCap];

export function AboutView() {
  return (
    <>
      <section className="relative overflow-hidden bg-forest-deeper text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_90%_0%,rgba(42,122,74,0.32),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wheat">
            Про нас
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
            Про компанію Alicorn Agro
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream/75 sm:text-lg">
            Alicorn Agro — це сучасний агросервіс, де інженерна точність
            зустрічається з глибоким розумінням фізіології рослин. Ми робимо
            врожаї більшим, а ваш бізнес ефективнішим.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Наша експертиза
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
            Працюємо з усіма типами агробізнесу
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            Маючи команду вузькопрофільних спеціалістів, ми можемо якісно
            обробити будь-який ваш запит.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {aboutExpertise.map((item, index) => {
            const Icon = expertiseIcons[index];
            return (
              <Reveal key={item.title} delay={index * 0.05}>
                <article className="h-full rounded-3xl bg-white p-6 ring-1 ring-forest/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(13,35,24,0.35)] sm:p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 font-display text-xl tracking-tight text-forest-dark">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {item.text}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
              Чому саме ми?
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
              Інженерія, наука і гнучкість під ваш запит
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {aboutValues.map((item, index) => {
              const Icon = valueIcons[index];
              return (
                <Reveal key={item.title} delay={index * 0.06}>
                  <article className="h-full rounded-3xl border border-forest/10 bg-cream p-7">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest text-cream">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-5 font-display text-xl tracking-tight text-forest-dark">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                      {item.text}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal>
          <div className="flex flex-col items-start gap-4 rounded-[2rem] bg-mint px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div className="flex items-start gap-4">
              <Sprout className="mt-1 h-6 w-6 shrink-0 text-forest" aria-hidden />
              <p className="max-w-2xl font-display text-xl tracking-tight text-forest-dark sm:text-2xl">
                Alicorn Agro — ваш надійний партнер у світі розумного
                землеробства.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
