import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.lorcast.io" },
      { protocol: "https", hostname: "lorcast.io" },
      { protocol: "https", hostname: "**.lorcanaapi.com" },
      { protocol: "https", hostname: "static.dreamborn.ink" },
    ],
  },
};

export default nextConfig;
