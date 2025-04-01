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
    webpackBuildWorker: false,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    serverExternalPackages: ['mongoose'],
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

// Async function to merge configs
async function getConfig() {
  let userConfig = {};
  try {
    userConfig = (await import('./v0-user-next.config')).default || {};
  } catch (e) {
    console.log('Nenhuma configuração de usuário encontrada');
  }

  function mergeConfigs(baseConfig, userConfig) {
    const merged = { ...baseConfig };
    
    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
          merged[key] = { ...baseConfig[key], ...userConfig[key] };
        } else {
          merged[key] = userConfig[key];
        }
      }
    }
    
    return merged;
  }

  const mergedConfig = mergeConfigs(nextConfig, userConfig);
  return withPWA(mergedConfig);
}

export default getConfig();