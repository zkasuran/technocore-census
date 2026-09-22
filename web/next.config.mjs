/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The census report is a static artifact rebuilt on each deploy, so pages are
  // statically generated and revalidated on a slow cadence. Long-tail key pages
  // fall back to on-demand rendering.
  experimental: {
    optimizePackageImports: ["recharts", "d3-force", "d3-scale"],
  },
};

export default nextConfig;
