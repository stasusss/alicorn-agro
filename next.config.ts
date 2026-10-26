import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite", "ws"],
};

export default nextConfig;
