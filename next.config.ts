// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization since we're API-only
  output: 'standalone',
  
  // Only build API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb', // For webhook payloads
    },
  },
};

module.exports = nextConfig;
