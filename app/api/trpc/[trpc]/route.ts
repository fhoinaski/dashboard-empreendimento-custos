import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/context';

// Configuração do endpoint tRPC
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }), // Compatível com a nova interface
    onError: ({ path, error }) => {
      console.error(`Erro no tRPC no caminho ${path}:`, error);
    },
    batching: { enabled: true },
  });

export { handler as GET, handler as POST };