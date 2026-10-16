import { ProductsView } from "@/components/products/products-view";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Продукція",
  description:
    "ClimateGuard — система активного моніторингу мікроклімату Alicorn Agro для теплиць, розсадників і садів.",
};

export default function ProductsPage() {
  return (
    <>
      <Script
        id="model-viewer"
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js"
        strategy="afterInteractive"
      />
      <ProductsView />
    </>
  );
}
