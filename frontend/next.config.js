/** @type {import('next').NextConfig} */
const nextConfig = {
  // Point API calls at the backend — set NEXT_PUBLIC_API_URL in .env.local
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  },

  images: {
    // Add your Hostinger upload domain when deploying
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '*.youragency.com' },
    ],
  },

  // Needed for Hostinger's Node.js standalone deployment
  output: 'standalone',
};

module.exports = nextConfig;
