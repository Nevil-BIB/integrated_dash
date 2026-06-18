import type { NextConfig } from "next";

// Pin Next/Turbopack's project root to this project's cwd so it does not walk
// up to the parent repo directory (which contains a stray package-lock.json
// and no node_modules) when resolving modules and tracing output.
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  // Required for pdfjs-dist and canvas to work properly in API routes
  // This prevents Next.js from bundling these native packages
  serverExternalPackages: [
    "pdfjs-dist",
    "pdf-to-img",
    "canvas",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;
