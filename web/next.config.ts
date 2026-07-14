import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cadence/db ships raw TypeScript from the monorepo; let Next transpile it.
  transpilePackages: ["@cadence/db"],
  images: {
    // Cover art is immutable once published — cache optimized variants for a
    // month so browsers/CDNs don't re-fetch on every navigation.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "*.coverartarchive.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "*.archive.org" },
    ],
  },
};

export default nextConfig;
