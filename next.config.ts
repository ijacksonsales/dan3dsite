import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default Next image optimizer does not run on Workers; images are
  // compressed in the browser before upload (see PLAN.md §5, phase 3).
  images: {
    unoptimized: true,
  },
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

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
