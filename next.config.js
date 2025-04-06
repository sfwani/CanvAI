/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure server-only runtime for specific API routes
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Add server external packages
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  skipNodeVersionCheck: true,
  // Increase API body size limit for file uploads (default is 4mb)
  apiBodySizeLimit: '16mb',
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