"use client";

import { useModal } from "@/components/modal-provider";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type ConsultButtonProps = {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "light";
  className?: string;
  showArrow?: boolean;
  onClick?: () => void;
};

const variants = {
  primary:
    "bg-forest text-white shadow-[0_12px_28px_-12px_rgba(31,92,56,0.55)] hover:bg-forest-mid",
  secondary:
    "bg-transparent text-forest-dark ring-1 ring-forest/20 hover:bg-mint",
  light:
    "bg-cream text-forest-dark hover:bg-white",
};

export function ConsultButton({
  children = "Записатися на консультацію",
  variant = "primary",
  className = "",
  showArrow = false,
  onClick,
}: ConsultButtonProps) {
  const { openModal } = useModal();

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openModal();
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] ${variants[variant]} ${className}`}
    >
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
    </button>
  );
}
