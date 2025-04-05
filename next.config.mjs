// next.config.mjs
import nextPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = nextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: isDev,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    // Remove serverExternalPackages and replace with the correct option if needed
    // serverExternalPackages: ['your-packages'],
    
    // If you need similar functionality, use serverComponentsExternalPackages instead
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: true,
      },
    ];
  },
};

export default withPWA(nextConfig);