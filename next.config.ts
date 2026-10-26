import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker on Hetzner needs the standalone server. Vercel builds its own output and fails if this is set.
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["@electric-sql/pglite", "ws"],
};

export default nextConfig;
