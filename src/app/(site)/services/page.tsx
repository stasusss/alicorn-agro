import { ServicesView } from "@/components/services/services-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Послуги",
  description:
    "Консультації з агробізнесу, дослідження ґрунтів, розробка технологій і постійна агрономічна підтримка.",
};

export default function ServicesPage() {
  return <ServicesView />;
}
