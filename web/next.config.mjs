/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The census report is a static artifact rebuilt on each deploy, so pages are
  // statically generated and revalidated on a slow cadence. Long-tail key pages
  // fall back to on-demand rendering.
  experimental: {
    optimizePackageImports: ["recharts", "d3-force", "d3-scale"],
  },
  // Bundle the full report into the server functions that read the long tail at
  // runtime. prepare-data writes web/data/report.json (inside the root) so tracing
  // can reach it; the repo-root copy outside the Next root cannot be traced.
  outputFileTracingIncludes: {
    "/api/key/[id]": ["./data/report.json"],
    "/api/network": ["./data/report.json"],
    "/api/stats": ["./data/report.json"],
    "/network": ["./data/report.json"],
  },
};

export default nextConfig;
