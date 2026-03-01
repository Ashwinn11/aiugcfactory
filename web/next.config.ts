import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Max body size for image uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
