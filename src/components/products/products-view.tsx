"use client";

import { ConsultButton } from "@/components/consult-button";
import { Reveal } from "@/components/reveal";
import {
  productMetrics,
  productProblems,
  productSpecs,
  productTable,
} from "@/lib/site";
import {
  BatteryCharging,
  BellRing,
  Cloud,
  Droplets,
  Leaf,
  Printer,
  ShieldCheck,
  Thermometer,
  Wind,
} from "lucide-react";

const metricIcons = [Thermometer, Droplets, Wind, Leaf];
const specIcons = [ShieldCheck, BatteryCharging, Printer, Cloud, BellRing];

export function ProductsView() {
  return (
    <>
      <section className="relative overflow-hidden bg-forest-deeper text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_420px_at_85%_10%,rgba(42,122,74,0.34),transparent_62%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-end gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wheat">
              Продукція
            </p>
            <h1 className="mt-4 font-display text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
              Система активного моніторингу мікроклімату Alicorn Agro
              (ClimateGuard)
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream/75 sm:text-lg">
              ClimateGuard — це апаратно-програмний комплекс для високоточного
              контролю параметрів середовища в реальному часі. На відміну від
              побутових метеостанцій чи пасивних датчиків, система спроєктована
              безпосередньо під технологічні вимоги закритого ґрунту (промислові
              теплиці, розсадники), садівництва та критичних зон вирощування.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/65 sm:text-base">
              Система поєднує активний забір повітря, лабораторну точність
              сенсорів та пряму інтеграцію з алгоритмами управління кліматичним
              обладнанням.
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wheat">
                Активний аспіраційний канал
              </p>
              <p className="mt-3 font-display text-4xl tracking-tight">IP65</p>
              <p className="mt-2 text-sm text-cream/65">
                Захист електронного відсіку від бризок, аерозолів і пилу.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Ключовий функціонал
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
            Вимірювані параметри
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
            Комплекс здійснює безперервний збір і математичну обробку
            агрономічних метрик.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {productMetrics.map((item, index) => {
            const Icon = metricIcons[index];
            return (
              <Reveal key={item.title} delay={index * 0.05}>
                <article className="h-full rounded-3xl bg-white p-6 ring-1 ring-forest/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(13,35,24,0.35)] sm:p-8">
                  <Icon className="h-5 w-5 text-forest" aria-hidden />
                  <h3 className="mt-4 font-display text-xl tracking-tight text-forest-dark">
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
              Інженерія та ПЗ
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
              Апаратні та програмні особливості
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productSpecs.map((item, index) => {
              const Icon = specIcons[index];
              return (
                <Reveal key={item.title} delay={index * 0.04}>
                  <article className="h-full rounded-3xl bg-cream p-6 ring-1 ring-forest/10">
                    <Icon className="h-5 w-5 text-forest" aria-hidden />
                    <h3 className="mt-4 font-display text-lg tracking-tight text-forest-dark">
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

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Технічні характеристики
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
            Специфікація ClimateGuard
          </h2>
        </Reveal>

        <Reveal className="mt-10">
          <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-forest/10">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Технічні характеристики системи ClimateGuard
              </caption>
              <thead className="bg-forest-dark text-cream">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold sm:px-6">
                    Параметр
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold sm:px-6">
                    Значення
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold sm:px-6">
                    Примітка
                  </th>
                </tr>
              </thead>
              <tbody>
                {productTable.map((row, index) => (
                  <tr
                    key={row.parameter}
                    className={index % 2 === 0 ? "bg-white" : "bg-mint/40"}
                  >
                    <th
                      scope="row"
                      className="px-5 py-4 font-medium text-forest-dark sm:px-6"
                    >
                      {row.parameter}
                    </th>
                    <td className="px-5 py-4 text-ink sm:px-6">{row.value}</td>
                    <td className="px-5 py-4 text-ink-muted sm:px-6">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
              Цінність для бізнесу
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
              Яку проблему вирішує для агробізнесу?
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {productProblems.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.05}>
                <article className="h-full rounded-3xl border border-forest/10 bg-cream p-6 sm:p-7">
                  <p className="font-display text-sm text-wheat">0{index + 1}</p>
                  <h3 className="mt-3 font-display text-xl tracking-tight text-forest-dark">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {item.text}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-[2rem] bg-mint px-6 py-10 sm:px-10 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
              Старт
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark">
              З чого почати: сила одного датчика
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-base">
              Не обов&apos;язково одразу інвестувати у розгалужену систему
              моніторингу. Ви можете розпочати цифровізацію свого господарства,
              придбавши всього один пристрій.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted sm:text-base">
              Навіть один AgroSense, встановлений у контрольній точці, дає
              об&apos;єктивну картину динаміки мікроклімату і показує
              економічний ефект до масштабування мережі датчиків.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
        <div className="rounded-[2rem] bg-forest-dark px-6 py-12 text-cream sm:px-10 lg:px-14 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wheat">
            Прайс і конфігурація
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-2xl tracking-tight sm:text-3xl">
            Підберемо ClimateGuard під ваше господарство
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/75 sm:text-base">
            Щоб отримати актуальний прайс-лист та підібрати конфігурацію, яка
            вирішить завдання саме вашого господарства, запишіться на
            безкоштовну експертну консультацію. Ми проаналізуємо ваш запит і
            запропонуємо економічно обґрунтоване рішення.
          </p>
          <div className="mt-8">
            <ConsultButton variant="light" showArrow />
          </div>
        </div>
      </section>
    </>
  );
}
