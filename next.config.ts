import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) used by the desktop app.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
