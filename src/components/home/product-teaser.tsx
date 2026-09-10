"use client";

import { motion } from "framer-motion";
import { ArrowRight, Radio } from "lucide-react";
import Link from "next/link";

const chips = ["Температура", "Вологість", "VPD", "Точка роси"];

export function ProductTeaser() {
  return (
    <section className="pb-20 sm:pb-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ y: 16 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45 }}
          className="overflow-hidden rounded-[2rem] bg-forest-dark text-cream"
        >
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 lg:py-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wheat">
                Продукція
              </p>
              <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
                Система активного моніторингу мікроклімату теплиць
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-cream/75 sm:text-base">
                ClimateGuard — апаратно-програмний комплекс для високоточного
                контролю середовища в реальному часі. Активний забір повітря,
                лабораторна точність сенсорів і пряма інтеграція з алгоритмами
                управління кліматом.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium text-cream/85 ring-1 ring-white/10"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3.5 text-sm font-semibold text-forest-dark transition-colors hover:bg-white"
                >
                  Дізнатися про ClimateGuard
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>

            <div className="relative min-h-[280px] bg-[radial-gradient(circle_at_70%_40%,rgba(42,122,74,0.45),transparent_58%)] p-6 sm:p-10">
              <div className="absolute inset-x-8 bottom-8 top-10 rounded-3xl border border-wheat/20 bg-forest-deeper/40 p-5 backdrop-blur-sm sm:inset-x-12">
                <div className="flex items-center gap-2 text-wheat">
                  <Radio className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                    AgroSense
                  </span>
                </div>
                <p className="mt-6 font-display text-5xl tracking-tight text-cream">
                  0.2°C
                </p>
                <p className="mt-2 text-sm text-cream/60">
                  похибка вимірювання температури
                </p>
                <div className="mt-8 h-px bg-white/10" />
                <p className="mt-6 text-sm leading-relaxed text-cream/70">
                  Активний аспіраційний канал, захист IP65 і канали зв’язку
                  Wi-Fi / LoRaWAN / GSM — система, спроєктована під закритий
                  ґрунт, а не під побутову метеостанцію.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
