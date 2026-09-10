import { ConsultationModal } from "@/components/consultation-modal";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ModalProvider } from "@/components/modal-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Alicorn Agro — розумне землеробство",
    template: "%s · Alicorn Agro",
  },
  description:
    "Сучасний агросервіс: консультації, дослідження ґрунтів, технології вирощування та система моніторингу мікроклімату ClimateGuard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${manrope.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream font-sans text-ink">
        <ModalProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ConsultationModal />
        </ModalProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
