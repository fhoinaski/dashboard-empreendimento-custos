// server/api/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type Context } from './context';

// Inicialização do tRPC com contexto tipado e transformer
const t = initTRPC.context<Context>().create({
  transformer: superjson, // Define superjson como transformer global
  errorFormatter({ shape }) {
    return shape; // Personalize o formato de erro, se necessário
  },
});

// Exportações principais
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Middleware de autenticação
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não autenticado' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user, // Passa o usuário autenticado para o contexto
    },
  });
});

// Middleware de super admin
const isSuperAdmin = middleware(async ({ ctx, next }) => {
  if (ctx.session?.user?.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a super administradores' });
  }
  return next();
});



// Middleware de admin
const isAdmin = middleware(async ({ ctx, next }) => {
  if (ctx.session?.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  return next();
});

// Procedimentos protegidos
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
export const superAdminProcedure = t.procedure.use(isAuthenticated).use(isSuperAdmin);