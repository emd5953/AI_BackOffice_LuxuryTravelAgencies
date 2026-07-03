import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module — must stay a server-side require, not be bundled
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
