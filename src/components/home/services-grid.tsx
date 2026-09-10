"use client";

import { services } from "@/lib/site";
import { motion } from "framer-motion";
import { ArrowUpRight, Cpu, Headset, LineChart, Sprout } from "lucide-react";
import Link from "next/link";

const icons = [LineChart, Sprout, Cpu, Headset];

export function ServicesGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">
          Послуги
        </p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-forest-dark sm:text-4xl">
          Супровід агробізнесу від аудиту до автоматизації
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Чотири напрями експертизи, щоб посилити врожайність і керованість
          господарства — незалежно від того, чи це поле, сад або теплиця.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {services.map((service, index) => {
          const Icon = icons[index];
          return (
            <motion.article
              key={service.title}
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Link
                href={service.href}
                className="group flex h-full flex-col rounded-3xl bg-white p-6 ring-1 ring-forest/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-28px_rgba(13,35,24,0.35)] hover:ring-forest/25 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-forest">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-sm text-wheat">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl tracking-tight text-forest-dark">
                  {service.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">
                  {service.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
                  Детальніше
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
