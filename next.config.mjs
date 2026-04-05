/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@worldcoin/idkit-core", "@worldcoin/idkit"],
  turbopack: {},
  devIndicators: false,
};

export default nextConfig;
