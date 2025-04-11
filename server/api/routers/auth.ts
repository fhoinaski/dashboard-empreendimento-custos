// ============================================================
// START OF REFACTORED FILE: server/api/routers/auth.ts
// (Fixed: Replaced adminProcedure with tenantAdminProcedure and use ctx.tenantId)
// ============================================================
import { router, publicProcedure, protectedProcedure, tenantAdminProcedure } from '../trpc'; // <-- Alterado: Usa tenantAdminProcedure
import { TRPCError } from '@trpc/server';
import { loginSchema, createUserSchema, userResponseSchema } from '../schemas/auth'; // Added userResponseSchema
import { hash, compare } from 'bcryptjs';
import { User, Empreendimento } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import mongoose, { Types } from 'mongoose'; // Import Types

/**
 * Roteador para autenticação
 * Gerencia rotas relacionadas à autenticação e registro de usuários
 */
export const authRouter = router({
  // Procedimento para registro de novos usuários (Tenant Admin only)
  register: tenantAdminProcedure // <-- CORRIGIDO: Usar tenantAdminProcedure
    .input(createUserSchema) // Usa o schema validado
    .mutation(async ({ input, ctx }) => { // ctx agora inclui tenantId garantido
      console.log(`[tRPC auth.register] Iniciando registro por Admin ${ctx.user!.id} no Tenant ${ctx.tenantId}. Input:`, input);
      if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'TenantId is required' });
      const adminTenantId = new Types.ObjectId(ctx.tenantId); // Obtém o ObjectId do tenant do admin

      try {
        await connectToDatabase();
        console.log("[tRPC auth.register] DB Conectado.");

        // Verificar se o email já existe NO MESMO TENANT
        const existingUser = await User.findOne({ email: input.email, tenantId: adminTenantId }); // <-- Adicionado filtro tenantId
        if (existingUser) {
           console.warn(`[tRPC auth.register] Email ${input.email} já existe no tenant ${adminTenantId}`);
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email já cadastrado neste tenant.',
          });
        }
        console.log(`[tRPC auth.register] Email ${input.email} disponível no tenant ${adminTenantId}.`);

        // Hash da senha
        console.log("[tRPC auth.register] Hashing password...");
        const hashedPassword = await hash(input.password, 12);

        // Validar e converter IDs de empreendimento DENTRO DO TENANT DO ADMIN
        let assignedEmpreendimentoObjectIds: Types.ObjectId[] = [];
        if (input.role === 'user' && input.assignedEmpreendimentos?.length) {
             console.log(`[tRPC auth.register] Validando empreendimentos [${input.assignedEmpreendimentos.join(',')}] para tenant ${adminTenantId}...`);
            const validIds = input.assignedEmpreendimentos.every(id => mongoose.isValidObjectId(id));
            if (!validIds) {
                 console.error("[tRPC auth.register] IDs de empreendimento inválidos recebidos.");
                 throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais IDs de empreendimento são inválidos' });
            }
            assignedEmpreendimentoObjectIds = input.assignedEmpreendimentos.map(id => new Types.ObjectId(id));

            // Verificar se empreendimentos existem E PERTENCEM AO TENANT DO ADMIN
             console.log("[tRPC auth.register] Verificando existência e posse dos empreendimentos...");
             // *** CORREÇÃO: Adicionar filtro de tenantId na busca de empreendimentos ***
            const existingEmpreendimentos = await Empreendimento.find({
                 _id: { $in: assignedEmpreendimentoObjectIds },
                 tenantId: adminTenantId // <-- Garante que pertencem ao tenant
            }).select('_id').lean();

            if (existingEmpreendimentos.length !== assignedEmpreendimentoObjectIds.length) {
                console.error(`[tRPC auth.register] Um ou mais empreendimentos não existem ou não pertencem ao tenant ${adminTenantId}.`);
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais empreendimentos atribuídos não existem ou não pertencem a este tenant.' });
            }
            console.log("[tRPC auth.register] Empreendimentos validados com sucesso.");
        }

        // Criar novo usuário com dados validados e tenantId do admin
        const userData: any = { // Use 'any' temporarily or define a more precise creation type
            tenantId: adminTenantId, // <-- Adiciona o tenantId do admin
            name: input.name,
            email: input.email,
            password: hashedPassword,
            role: input.role, // Garante que a role passada seja usada (admin, manager, user)
            assignedEmpreendimentos: input.role === 'user' ? assignedEmpreendimentoObjectIds : [], // Limpa para admin/manager
            // Adiciona preferências padrão
            notificationPreferences: {
                emailDespesasVencer: true, emailDocumentosNovos: true, emailRelatoriosSemanais: false,
                systemDespesasVencer: true, systemDocumentosNovos: true, systemEventosCalendario: true,
                antecedenciaVencimento: 3,
            },
            preferences: { language: 'pt-BR', dateFormat: 'dd/MM/yyyy', currency: 'BRL' },
        };

        console.log("[tRPC auth.register] Criando usuário com dados:", JSON.stringify(userData, null, 2));
        const newUser = await User.create(userData);
        console.log(`[tRPC auth.register] Usuário criado com ID: ${newUser._id} no Tenant ${newUser.tenantId}`);

        // Buscar nomes dos empreendimentos atribuídos para a resposta
        let assignedEmpreendimentosResp: { _id: string; name: string; }[] = [];
        if (newUser.assignedEmpreendimentos && newUser.assignedEmpreendimentos.length > 0) {
            const empDocs = await Empreendimento.find({ _id: { $in: newUser.assignedEmpreendimentos } }).select('_id name').lean();
            assignedEmpreendimentosResp = empDocs.map(e => ({ _id: e._id.toString(), name: e.name }));
        }

        return {
          success: true,
          message: 'Usuário criado com sucesso',
          user: userResponseSchema.parse({ // Validar a resposta
            _id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            avatarUrl: newUser.avatarUrl ?? null,
            notificationPreferences: newUser.notificationPreferences,
            preferences: newUser.preferences,
            assignedEmpreendimentos: assignedEmpreendimentosResp,
            createdAt: newUser.createdAt.toISOString(),
            updatedAt: newUser.updatedAt.toISOString(),
          }),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[tRPC auth.register] Erro:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao criar usuário',
          cause: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }),

  // Procedimento para verificar credenciais (usado internamente pelo NextAuth `authorize`)
  // Mantido como publicProcedure
  verifyCredentials: publicProcedure
    .input(loginSchema)
    .query(async ({ input }) => {
       // console.log(`[tRPC verifyCredentials] Verificando: ${input.email}`);
      try {
        await connectToDatabase();
        const user = await User.findOne({ email: input.email }).lean();
        if (!user) throw new Error('Credenciais inválidas'); // Erro genérico
        if (!user.password) throw new Error('Conta inválida'); // Erro genérico
        const passwordValid = await compare(input.password, user.password);
        if (!passwordValid) throw new Error('Credenciais inválidas'); // Erro genérico

        // *** Superadmin Check: Precisa ter role 'superadmin' E tenantId null/undefined ***
        const isSuperAdmin = user.role === 'superadmin' && !user.tenantId;
        // *** Non-Superadmin Check: Precisa ter tenantId E ser um ObjectId válido ***
        const isValidTenantUser = !isSuperAdmin && user.tenantId && mongoose.isValidObjectId(user.tenantId);

        if (!isSuperAdmin && !isValidTenantUser) {
             console.error(`[tRPC verifyCredentials] Configuração inválida para usuário ${user.email}. Role: ${user.role}, TenantId: ${user.tenantId}`);
             throw new Error('Configuração de conta inválida.');
        }
        // console.log(`[tRPC verifyCredentials] Credenciais OK para: ${input.email}`);

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          // *** Garante tenantId: null para superadmin no retorno ***
          tenantId: isSuperAdmin ? null : user.tenantId?.toString() ?? null,
          avatarUrl: user.avatarUrl,
          assignedEmpreendimentos: user.assignedEmpreendimentos?.map(id => id.toString()) || [],
        };
      } catch (error) {
        console.error('[tRPC verifyCredentials] Erro:', error);
        // Lança erro genérico para o `authorize` do NextAuth capturar
        throw new Error(error instanceof Error ? error.message : 'Falha na verificação');
      }
    }),

  // Procedimento para obter dados do usuário logado atualmente
  // Mantido como protectedProcedure
  me: protectedProcedure
    .query(async ({ ctx }) => {
      console.log(`[tRPC auth.me] Buscando dados para usuário ID: ${ctx.user.id}`);
      try {
        await connectToDatabase();
        const userId = ctx.user.id;
        const user = await User.findById(userId)
          .select('-password')
          .populate<{ assignedEmpreendimentos: { _id: Types.ObjectId; name: string }[] }>('assignedEmpreendimentos', '_id name') // Popula nomes
          .lean();

        if (!user) {
           console.error(`[tRPC auth.me] Usuário não encontrado no DB: ${userId}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }
        console.log(`[tRPC auth.me] Dados encontrados para: ${user.email}`);

        return userResponseSchema.parse({ // Validar resposta
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl ?? null,
          notificationPreferences: user.notificationPreferences,
          preferences: user.preferences,
          // Mapeia os documentos populados para o formato esperado
          assignedEmpreendimentos: (user.assignedEmpreendimentos || []).map(emp => ({
              _id: emp._id.toString(),
              name: emp.name,
          })),
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC auth.me] Erro:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar dados do usuário' });
      }
    }),
});

// ============================================================
// END OF REFACTORED FILE: server/api/routers/auth.ts
// ============================================================