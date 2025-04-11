// ============================================================
// START OF REFACTORED FILE: server/api/context/index.ts (Multi-Tenancy)
// ============================================================
import { inferAsyncReturnType } from '@trpc/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options'; // authOptions já tipadas

// Interface para o contexto do tRPC no App Router
interface CreateContextOptions {
  req: Request;
}

// Função para criar o contexto
export async function createTRPCContext({ req }: CreateContextOptions) {
  // Session já está corretamente tipada via module augmentation em options.ts
  const session = await getServerSession({ req, ...authOptions });

  console.log("[tRPC Context] Session obtida:", session ? `User: ${session.user?.id}, Tenant: ${session.user?.tenantId}` : "Nenhuma");

  // Retorna o contexto, incluindo tenantId
  return {
    req,
    session,
    user: session?.user ?? null,
    tenantId: session?.user?.tenantId ?? null, // <-- Adicionado tenantId
  };
}

// Tipo do contexto inferido automaticamente
export type Context = inferAsyncReturnType<typeof createTRPCContext>;
// ============================================================
// END OF REFACTORED FILE: server/api/context/index.ts
// ============================================================