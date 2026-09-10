"use client";

import { useModal } from "@/components/modal-provider";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";

const fields = [
  {
    name: "name",
    label: "Ім’я",
    type: "text",
    autoComplete: "name",
    required: true,
  },
  {
    name: "phone",
    label: "Номер телефону",
    type: "tel",
    autoComplete: "tel",
    required: true,
  },
  {
    name: "email",
    label: "Електронна пошта",
    type: "email",
    autoComplete: "email",
    required: true,
  },
  {
    name: "time",
    label: "Зручний час",
    type: "text",
    placeholder: "Наприклад: завтра після 14:00",
    required: true,
  },
] as const;

export function ConsultationModal() {
  const { isOpen, closeModal } = useModal();
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleClose = useCallback(() => {
    setSubmitted(false);
    closeModal();
  }, [closeModal]);

  useEffect(() => {
    if (!isOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 80);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [isOpen, handleClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Закрити вікно"
            className="absolute inset-0 bg-forest-deeper/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream shadow-2xl sm:max-w-lg sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-forest/10 px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest">
                  Alicorn Agro
                </p>
                <h2
                  id={titleId}
                  className="mt-1 font-display text-xl text-forest-dark sm:text-2xl"
                >
                  Запис на консультацію
                </h2>
                {submitted ? null : (
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    Заповніть анкету — ми зв’яжемося з вами та підберемо рішення
                    під ваше господарство.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink"
                aria-label="Закрити"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center px-6 py-12 text-center sm:px-8">
                <CheckCircle2 className="h-12 w-12 text-forest" />
                <p className="mt-4 font-display text-xl text-forest-dark">
                  Заявку надіслано
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
                  Дякуємо. Наш спеціаліст зв’яжеться з вами найближчим часом,
                  щоб узгодити консультацію.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white hover:bg-forest-mid"
                >
                  Закрити
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6 sm:px-8">
                {fields.map((field, index) => (
                  <label key={field.name} className="block">
                    <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                      {field.label}
                    </span>
                    <input
                      ref={index === 0 ? firstFieldRef : undefined}
                      name={field.name}
                      type={field.type}
                      autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                      placeholder={"placeholder" in field ? field.placeholder : undefined}
                      required={field.required}
                      className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-ink outline-none transition-shadow placeholder:text-ink-muted/50 focus:border-forest focus:ring-4 focus:ring-forest/10"
                    />
                  </label>
                ))}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Примітки
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Коротко опишіть запит або тип господарства"
                    className="w-full resize-y rounded-xl border border-forest/15 bg-white px-4 py-3 text-ink outline-none transition-shadow placeholder:text-ink-muted/50 focus:border-forest focus:ring-4 focus:ring-forest/10"
                  />
                </label>

                <button
                  type="submit"
                  className="mt-2 w-full rounded-full bg-forest py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(31,92,56,0.55)] transition-colors hover:bg-forest-mid"
                >
                  Надіслати заявку
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
