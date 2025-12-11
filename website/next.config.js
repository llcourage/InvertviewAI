/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    VERCEL_API_URL: process.env.VERCEL_API_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;


