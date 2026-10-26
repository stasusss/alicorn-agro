import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/about", "/services", "/products"].map((path) => ({
    url: new URL(path, site.url).toString(),
    lastModified: new Date(),
  }));
}
