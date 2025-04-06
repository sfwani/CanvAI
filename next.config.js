/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add server external packages
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Basic Next.js settings
  distDir: '.next',
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig; 