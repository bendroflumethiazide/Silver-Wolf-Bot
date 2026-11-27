import type { NextConfig } from "next";

// WEB_EDITION=1 builds a static website (GitHub Pages) with no server; see scripts/build-web.mjs.
const web = process.env.NEXT_PUBLIC_WEB_EDITION === "1";
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = web
  ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true }, poweredByHeader: false, env: { NEXT_PUBLIC_BASE_PATH: basePath } }
  : {
      // Self-contained server bundle (.next/standalone) used by the desktop app.
      output: "standalone",
      poweredByHeader: false,
    };

export default nextConfig;
