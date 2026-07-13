import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @cadence/db ships raw TypeScript from the monorepo; let Next transpile it.
  transpilePackages: ["@cadence/db"],
};

export default nextConfig;
