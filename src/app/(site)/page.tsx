import { Hero } from "@/components/home/hero";
import { ProductTeaser } from "@/components/home/product-teaser";
import { ServicesGrid } from "@/components/home/services-grid";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServicesGrid />
      <ProductTeaser />
    </>
  );
}
