import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the InnerTube clients as real Node modules (they ship JS-interpreter
  // and cookie-jar code that must not be bundled).
  serverExternalPackages: ["youtubei.js", "ytmusic-api", "jintr", "jsdom", "bgutils-js"],

  // The PO-token minter runs in a real worker thread at runtime. Because the
  // Worker constructor receives a computed path, Next's file tracer cannot
  // discover this file automatically; Vercel would otherwise deploy the route
  // without workers/pot-worker.mjs and every production stream would fail.
  outputFileTracingIncludes: {
    "/*": ["./workers/**/*"],
  },
};

export default nextConfig;
