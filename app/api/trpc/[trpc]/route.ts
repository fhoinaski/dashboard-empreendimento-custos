// FILE: app/api/trpc/[trpc]/route.ts
// STATUS: CORRECTED (Import Path)

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
// --- CORREÇÃO: Garantir que o alias aponta para o diretório correto ---
import { createTRPCContext } from '@/server/api/context'; // Usando o alias que aponta para /server/api/context/index.ts

// Configuração do endpoint tRPC
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    // A função createTRPCContext espera um objeto com a propriedade 'req'
    createContext: () => createTRPCContext({ req }),
    onError: ({ path, error }) => {
      console.error(`tRPC Error on ${path}:`, error); // Log mais detalhado
    },
    batching: { enabled: true },
  });

export { handler as GET, handler as POST };