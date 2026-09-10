import { ProductsView } from "@/components/products/products-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Продукція",
  description:
    "ClimateGuard — система активного моніторингу мікроклімату Alicorn Agro для теплиць, розсадників і садів.",
};

export default function ProductsPage() {
  return <ProductsView />;
}
