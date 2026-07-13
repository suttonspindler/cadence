import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cadence/db ships raw TypeScript from the monorepo; let Next transpile it.
  transpilePackages: ["@cadence/db"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "https", hostname: "*.coverartarchive.org" },
    ],
  },
};

export default nextConfig;
