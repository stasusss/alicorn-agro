"use client";

import { ConsultButton } from "@/components/consult-button";
import { Reveal } from "@/components/reveal";
import { serviceCatalog } from "@/lib/site";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Cpu, Headset, LineChart, Sprout } from "lucide-react";
import { useEffect, useState } from "react";

const icons = [LineChart, Sprout, Cpu, Headset];

export function ServicesView() {
  const [openId, setOpenId] = useState<string>(serviceCatalog[0].id);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (serviceCatalog.some((service) => service.id === hash)) {
        setOpenId(hash);
      }
    };

    const frame = window.requestAnimationFrame(applyHash);
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", applyHash);
    };
  }, []);

  return (
    <>
      <section className="relative overflow-hidden bg-forest-deeper text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_360px_at_12%_0%,rgba(201,169,106,0.16),transparent_58%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wheat">
            Послуги
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-3xl leading-tight font-medium tracking-tight sm:text-5xl">
            Послуги Alicorn Agro
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cream/75 sm:text-lg">
            Від аудиту господарства до цифрового контролю мікроклімату — кожна
            послуга адаптується під ваш тип виробництва.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="space-y-4">
          {serviceCatalog.map((service, index) => {
            const Icon = icons[index];
            const isOpen = openId === service.id;

            return (
              <Reveal key={service.id} delay={index * 0.04}>
                <article
                  id={service.id}
                  className="scroll-mt-28 overflow-hidden rounded-3xl bg-white ring-1 ring-forest/10"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenId((current) =>
                        current === service.id ? "" : service.id,
                      )
                    }
                    className="flex w-full items-start gap-4 p-6 text-left transition-colors hover:bg-mint/40 sm:p-8"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-forest">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-3">
                        <span className="font-display text-sm text-wheat">
                          0{index + 1}
                        </span>
                        <span className="font-display text-xl tracking-tight text-forest-dark sm:text-2xl">
                          {service.title}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-ink-muted">
                        {service.intro}
                      </span>
                    </span>
                    <ChevronDown
                      className={`mt-1 h-5 w-5 shrink-0 text-forest transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <ul className="grid gap-3 border-t border-forest/10 px-6 pb-6 sm:grid-cols-2 sm:px-8 sm:pb-8">
                          {service.items.map((item) => (
                            <li
                              key={item.title}
                              className="rounded-2xl bg-cream px-5 py-4"
                            >
                              <p className="font-semibold text-forest-dark">
                                {item.title}
                              </p>
                              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                                {item.text}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="rounded-[2rem] bg-forest-dark px-6 py-12 text-cream sm:px-10 lg:px-14 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-wheat">
            Індивідуальний кошторис
          </p>
          <h2 className="mt-3 max-w-3xl font-display text-2xl tracking-tight sm:text-3xl">
            Розрахуємо вартість під ваше господарство
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/75 sm:text-base">
            Оскільки вартість послуг розраховується індивідуально, ми не
            вказуємо ціни на сайті. Заповніть анкету, і ми обов&apos;язково
            проконсультуємо вас та складемо точний кошторис.
          </p>
          <div className="mt-8">
            <ConsultButton variant="light" showArrow />
          </div>
        </div>
      </section>
    </>
  );
}
