/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false, // Recomendo mudar para false para capturar erros
  },
  images: {
    unoptimized: false, // Melhor para performance
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Permite todas as imagens remotas
      },
    ],
  },
  experimental: {
    webpackBuildWorker: false, // Desative se estiver causando problemas
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    serverComponentsExternalPackages: ['mongoose'], // Adicione se usar mongoose
  },
  // Adicione configurações de logging para depuração
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Configuração para API routes
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Aumente conforme necessário
    },
  },
}

// Verifique se há configurações de usuário
let userConfig = {}
try {
  userConfig = (await import('./v0-user-next.config')).default || {}
} catch (e) {
  console.log('Nenhuma configuração de usuário encontrada')
}

// Função de merge melhorada
function mergeConfigs(baseConfig, userConfig) {
  const merged = { ...baseConfig }
  
  for (const key in userConfig) {
    if (userConfig.hasOwnProperty(key)) {
      if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        merged[key] = { ...baseConfig[key], ...userConfig[key] }
      } else {
        merged[key] = userConfig[key]
      }
    }
  }
  
  return merged
}

export default mergeConfigs(nextConfig, userConfig)