// ============================================================
// server/api/trpc.ts (CONFIRMADO - CORRETO)
// ============================================================
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type Context } from './context'; // Context agora tem tenantId opcional

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) { return shape; },
});

// Exportações principais
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// --- Middlewares ---

/**
 * Middleware de autenticação BÁSICA:
 * Verifica apenas se o usuário está logado (tem ID na sessão).
 */
const isAuthenticated = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    console.warn("[Middleware isAuthenticated] Falha: ID do usuário ausente na sessão.");
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
  }
  console.log(`[Middleware isAuthenticated] OK: User ${ctx.session.user.id}`);
  // Passa o user da sessão para o próximo contexto
  return next({ ctx: { ...ctx, user: ctx.session.user } });
});

/**
 * Middleware de MEMBRO DE TENANT:
 * Verifica se o usuário está logado E possui um tenantId válido associado.
 * Roda DEPOIS do isAuthenticated.
 */
const isTenantMember = middleware(async ({ ctx, next }) => {
   // Verifica se user e tenantId existem e se tenantId é um ObjectId válido
   if (!ctx.user?.tenantId || !/^[0-9a-fA-F]{24}$/.test(ctx.user.tenantId)) {
      console.warn(`[Middleware isTenantMember] Falha: Usuário ${ctx.user?.id} não tem tenantId válido (${ctx.user?.tenantId}).`);
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a membros de um tenant.' });
   }
   console.log(`[Middleware isTenantMember] OK: User ${ctx.user.id} pertence ao Tenant ${ctx.user.tenantId}`);
   // Passa o tenantId explicitamente para o próximo contexto
   return next({ ctx: { ...ctx, tenantId: ctx.user.tenantId } });
});

/**
 * Middleware de ADMIN DE TENANT:
 * Verifica se o usuário é 'admin' E pertence a um tenant.
 * Roda DEPOIS do isTenantMember.
 */
const isTenantAdmin = middleware(async ({ ctx, next }) => {
   // ctx.tenantId já foi validado pelo middleware isTenantMember
   if (ctx.user?.role !== 'admin') {
     console.warn(`[Middleware isTenantAdmin] Falha: Usuário ${ctx.user?.id} (Tenant: ${ctx.tenantId}) não é admin (Role: ${ctx.user?.role}).`);
     throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores do tenant.' });
   }
   console.log(`[Middleware isTenantAdmin] OK: User ${ctx.user.id} é admin do Tenant ${ctx.tenantId}.`);
   return next({ ctx }); // Passa o contexto adiante
});

/**
 * Middleware de SUPER ADMIN:
 * Verifica se a role é 'superadmin' E tenantId é null.
 * Roda DEPOIS do isAuthenticated.
 */
const isSuperAdmin = middleware(async ({ ctx, next }) => {
  // Verifica a role e se o tenantId é explicitamente null
  const superAdminCheck = ctx.user?.role === 'superadmin' && ctx.user?.tenantId === null;
  if (!superAdminCheck) {
      console.warn(`[Middleware isSuperAdmin] Falha: Usuário ${ctx.user?.id} (Role: ${ctx.user?.role}, Tenant: ${ctx.user?.tenantId}) não é Super Admin.`);
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito ao Super Administrador.' });
  }
   console.log(`[Middleware isSuperAdmin] OK: User ${ctx.user?.id} é Super Admin.`);
   // Passa o contexto adiante (com user, mas tenantId será null)
  return next({ ctx });
});

// --- Procedimentos Exportados ---

/** Procedimento público (não requer autenticação) */
// publicProcedure já estava definido e exportado

/** Procedimento protegido (requer apenas autenticação, qualquer role, com ou sem tenant) */
export const protectedProcedure = t.procedure.use(isAuthenticated);

/** Procedimento de membro de tenant (requer autenticação E associação a um tenant) */
export const tenantProcedure = protectedProcedure.use(isTenantMember);

/** Procedimento de admin de tenant (requer autenticação, tenant E role 'admin') */
export const tenantAdminProcedure = tenantProcedure.use(isTenantAdmin); // Combina isTenantMember e isTenantAdmin

/** Procedimento de super admin (requer autenticação E role 'superadmin' sem tenant) */
export const superAdminProcedure = protectedProcedure.use(isSuperAdmin);

// ============================================================
// END OF FILE: server/api/trpc.ts
// ============================================================