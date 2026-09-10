"use client";

import { useModal } from "@/components/modal-provider";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type FormValues = {
  name: string;
  phone: string;
  email: string;
  time: string;
  notes: string;
};

const emptyForm: FormValues = {
  name: "",
  phone: "",
  email: "",
  time: "",
  notes: "",
};

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};

  if (values.name.trim().length < 2) {
    errors.name = "Вкажіть ім’я (мінімум 2 символи).";
  }

  const digits = values.phone.replace(/\D/g, "");
  if (digits.length < 10) {
    errors.phone = "Вкажіть коректний номер телефону.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Вкажіть коректну електронну пошту.";
  }

  if (values.time.trim().length < 2) {
    errors.time = "Вкажіть зручний час для дзвінка.";
  }

  return errors;
}

export function ConsultationModal() {
  const { isOpen, closeModal } = useModal();
  const titleId = useId();
  const errorId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>(
    {},
  );

  const handleClose = useCallback(() => {
    setSubmitted(false);
    setErrors({});
    setValues(emptyForm);
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

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSubmitted(true);
  }

  const fieldClass =
    "w-full rounded-xl border bg-white px-4 py-3 text-ink outline-none transition-shadow placeholder:text-ink-muted/50 focus:ring-4";

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
            onClick={(event) => event.stopPropagation()}
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
                  className="mt-8 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-forest-mid"
                >
                  Закрити
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6 sm:px-8" noValidate>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Ім’я
                  </span>
                  <input
                    ref={firstFieldRef}
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? `${errorId}-name` : undefined}
                    className={`${fieldClass} ${
                      errors.name
                        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                        : "border-forest/15 focus:border-forest focus:ring-forest/10"
                    }`}
                  />
                  {errors.name ? (
                    <span id={`${errorId}-name`} className="mt-1.5 block text-xs text-red-600">
                      {errors.name}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Номер телефону
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={values.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? `${errorId}-phone` : undefined}
                    className={`${fieldClass} ${
                      errors.phone
                        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                        : "border-forest/15 focus:border-forest focus:ring-forest/10"
                    }`}
                  />
                  {errors.phone ? (
                    <span id={`${errorId}-phone`} className="mt-1.5 block text-xs text-red-600">
                      {errors.phone}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Електронна пошта
                  </span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={(event) => update("email", event.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${errorId}-email` : undefined}
                    className={`${fieldClass} ${
                      errors.email
                        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                        : "border-forest/15 focus:border-forest focus:ring-forest/10"
                    }`}
                  />
                  {errors.email ? (
                    <span id={`${errorId}-email`} className="mt-1.5 block text-xs text-red-600">
                      {errors.email}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Зручний час
                  </span>
                  <input
                    name="time"
                    type="text"
                    placeholder="Наприклад: завтра після 14:00"
                    value={values.time}
                    onChange={(event) => update("time", event.target.value)}
                    aria-invalid={Boolean(errors.time)}
                    aria-describedby={errors.time ? `${errorId}-time` : undefined}
                    className={`${fieldClass} ${
                      errors.time
                        ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                        : "border-forest/15 focus:border-forest focus:ring-forest/10"
                    }`}
                  />
                  {errors.time ? (
                    <span id={`${errorId}-time`} className="mt-1.5 block text-xs text-red-600">
                      {errors.time}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-forest-dark">
                    Примітки
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Коротко опишіть запит або тип господарства"
                    value={values.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    className={`${fieldClass} resize-y border-forest/15 focus:border-forest focus:ring-forest/10`}
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
