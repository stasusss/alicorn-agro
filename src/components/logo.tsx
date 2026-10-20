import Link from "next/link";

type LogoProps = {
  variant?: "mark" | "lockup";
  tone?: "brand" | "light";
  href?: string;
};

export function Logo({ variant = "mark", tone = "brand", href = "/" }: LogoProps) {
  const light = tone === "light";

  if (variant === "lockup") {
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label="Alicorn Agro — на головну">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={light ? "/logo-lockup-light.png" : "/logo-lockup.png"}
          alt=""
          width={1024}
          height={550}
          className="h-24 w-auto sm:h-28"
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-2.5 ${light ? "text-cream" : "text-ink"}`}
      aria-label="Alicorn Agro — на головну"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark.png"
        alt=""
        width={602}
        height={640}
        className="h-9 w-auto md:h-10"
      />
      <span
        className={`font-display text-[0.95rem] font-medium tracking-tight md:text-base ${
          light ? "text-cream" : "text-forest-dark"
        }`}
      >
        Alicorn Agro
      </span>
    </Link>
  );
}
