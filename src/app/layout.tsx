import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { site } from "@/lib/site";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const description =
  "Сучасний агросервіс: консультації, дослідження ґрунтів, технології вирощування та система моніторингу мікроклімату ClimateGuard.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Alicorn Agro — розумне землеробство",
    template: "%s · Alicorn Agro",
  },
  description,
  applicationName: site.name,
  alternates: {
    canonical: "./",
  },
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: site.name,
    url: "./",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Логотип Alicorn Agro",
      },
    ],
  },
  twitter: {
    card: "summary",
    images: ["/icon.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/icon.png`,
  email: site.email,
  telephone: site.phone,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${manrope.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream font-sans text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
