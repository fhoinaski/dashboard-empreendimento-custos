import { inferAsyncReturnType } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

// Interface para o contexto do tRPC no App Router
interface CreateContextOptions {
  req: Request; // Apenas req é necessário no App Router com fetchRequestHandler
}

// Função para criar o contexto
export async function createTRPCContext({ req }: CreateContextOptions) {
  // Adaptar o req para o formato esperado pelo NextAuth no App Router
  const session = await getServerSession({
    req,
    ...authOptions, // Espalha as opções de autenticação diretamente
  });

  return {
    req,
    session,
    user: session?.user ?? null, // Inclui user para consistência com as rotas
  };
}

// Tipo do contexto inferido automaticamente
export type Context = inferAsyncReturnType<typeof createTRPCContext>;