import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the InnerTube clients as real Node modules (they ship JS-interpreter
  // and cookie-jar code that must not be bundled).
  serverExternalPackages: ["youtubei.js", "ytmusic-api", "jintr", "jsdom", "bgutils-js"],
};

export default nextConfig;
