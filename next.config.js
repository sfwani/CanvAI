/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add server external packages
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Basic Next.js settings
  distDir: '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  // Disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; 