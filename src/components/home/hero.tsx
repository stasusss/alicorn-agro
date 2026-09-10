"use client";

import { ConsultButton } from "@/components/consult-button";
import { motion } from "framer-motion";
import { ArrowDownRight, Droplets, Leaf, Thermometer, Wind } from "lucide-react";
import Link from "next/link";

const metrics = [
  { icon: Thermometer, label: "Температура", value: "24.2°C", hint: "зона вегетації" },
  { icon: Droplets, label: "Вологість", value: "68%", hint: "відносна RH" },
  { icon: Wind, label: "VPD", value: "1.12 кПа", hint: "транспірація" },
  { icon: Leaf, label: "Точка роси", value: "17.8°C", hint: "без конденсату" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-forest-deeper text-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_480px_at_85%_15%,rgba(42,122,74,0.35),transparent_60%),radial-gradient(700px_420px_at_10%_90%,rgba(201,169,106,0.12),transparent_55%)]"
      />
      <GreenhouseWireframe />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-24">
        <div className="lg:col-span-7">
          <motion.p
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-xs font-semibold uppercase tracking-[0.22em] text-wheat"
          >
            Розумне землеробство
          </motion.p>
          <motion.h1
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-4 max-w-3xl font-display text-[2.15rem] leading-[1.12] font-medium tracking-tight sm:text-5xl lg:text-[3.35rem]"
          >
            Контролюйте кожен фактор, що впливає на врожай
          </motion.h1>
          <motion.p
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-cream/75 sm:text-lg"
          >
            Інженерна точність зустрічається з фізіологією рослин. Ми робимо
            врожаї більшими, а ваш агробізнес — ефективнішим.
          </motion.p>
          <motion.div
            initial={{ y: 14 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <ConsultButton variant="light" showArrow />
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-cream/85 ring-1 ring-white/20 transition-colors hover:bg-white/5 hover:text-white"
            >
              Переглянути послуги
              <ArrowDownRight className="h-4 w-4" aria-hidden />
            </Link>
          </motion.div>
        </div>

        <motion.aside
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="lg:col-span-5"
        >
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-md sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-display text-sm text-cream">ClimateGuard</p>
                <p className="text-xs text-cream/55">AgroSense · контрольна точка</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-mid/40 px-2.5 py-1 text-[0.7rem] font-semibold text-wheat-light">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wheat opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-wheat" />
                </span>
                онлайн
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-3">
              {metrics.map((metric) => (
                <li
                  key={metric.label}
                  className="rounded-2xl bg-forest-deeper/50 p-3.5 ring-1 ring-white/8"
                >
                  <metric.icon className="h-4 w-4 text-wheat" aria-hidden />
                  <p className="mt-3 font-display text-xl tracking-tight text-cream">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-xs text-cream/70">{metric.label}</p>
                  <p className="text-[0.65rem] text-cream/40">{metric.hint}</p>
                </li>
              ))}
            </ul>
          </div>
        </motion.aside>
      </div>
    </section>
  );
}

function GreenhouseWireframe() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute -right-16 top-8 h-[120%] w-[58%] opacity-[0.14] sm:right-0"
      viewBox="0 0 640 720"
      fill="none"
    >
      <path d="M40 520 L320 120 L600 520" stroke="#e8d7a8" strokeWidth="1.2" />
      <path d="M40 520 H600 V680 H40 Z" stroke="#e8d7a8" strokeWidth="1.2" />
      <path d="M180 520 V680 M320 120 V680 M460 520 V680" stroke="#e8d7a8" strokeWidth="0.8" />
      <path d="M40 600 H600 M110 360 L320 200 L530 360" stroke="#e8d7a8" strokeWidth="0.7" />
      <path d="M180 440 L320 280 L460 440" stroke="#e8d7a8" strokeWidth="0.7" />
    </svg>
  );
}
