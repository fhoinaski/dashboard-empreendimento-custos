// next.config.mjs
import nextPWA from 'next-pwa';

const isDev = process.env.NODE_ENV === 'development';

const withPWA = nextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Alterado de isDev para false para habilitar o PWA em todos os ambientes
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
  // Atualizado conforme recomendação do Next.js
  serverExternalPackages: ['mongoose', 'mongodb'],
  experimental: {
    // Mantendo experimental para outras configurações futuras
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