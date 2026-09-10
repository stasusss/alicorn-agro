"use client";

import Link from "next/link";

type LogoProps = {
  inverted?: boolean;
};

export function Logo({ inverted = false }: LogoProps) {
  return (
    <Link
      href="/"
      className={`group flex items-center gap-2.5 ${inverted ? "text-cream" : "text-ink"}`}
      aria-label="Alicorn Agro — на головну"
    >
      {/* Swap /logo.svg with the official brand file when available */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        width={40}
        height={40}
        className="h-9 w-9 shrink-0 rounded-xl md:h-10 md:w-10"
      />
      <span
        className={`font-display text-[0.95rem] font-medium tracking-tight md:text-base ${
          inverted ? "text-cream" : "text-forest-dark"
        }`}
      >
        Alicorn Agro
      </span>
    </Link>
  );
}
