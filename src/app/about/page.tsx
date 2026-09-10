import { AboutView } from "@/components/about/about-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Про нас",
  description:
    "Alicorn Agro — сучасний агросервіс, де інженерна точність зустрічається з фізіологією рослин.",
};

export default function AboutPage() {
  return <AboutView />;
}
