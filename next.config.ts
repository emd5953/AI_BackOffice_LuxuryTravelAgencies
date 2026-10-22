import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mailparser", "unpdf"],
};

export default nextConfig;
