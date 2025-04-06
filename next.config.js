/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure server-only runtime for specific API routes
  experimental: {},
  // Add server external packages
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  // Increase API body size limit for file uploads (default is 4mb)
  distDir: '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 