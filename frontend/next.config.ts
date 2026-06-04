import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400/api",
  },
  // @ts-ignore - Some versions of NextConfig don't type allowedDevOrigins yet
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
