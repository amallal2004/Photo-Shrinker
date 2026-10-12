import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure client-side app: emits a static bundle that runs on any static host
  // (Cloudflare Pages, Vercel, GitHub Pages, plain nginx).
  output: "export",
  images: {
    unoptimized: true,
  },
  // No server runtime is used, so the partial-prefetch cache has nothing to do.
  partialPrefetching: false,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;