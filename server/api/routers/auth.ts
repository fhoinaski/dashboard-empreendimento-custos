
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc'; // Use adminProcedure for register
import { TRPCError } from '@trpc/server';
import { loginSchema, createUserSchema } from '../schemas/auth';
import { hash, compare } from 'bcryptjs';
import { User, Empreendimento } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import mongoose, { Types } from 'mongoose'; // Import Types

/**
 * Roteador para autenticação
 * Gerencia rotas relacionadas à autenticação e registro de usuários
 */
export const authRouter = router({
  // Procedimento para registro de novos usuários (Admin only)
  // Equivalente a: POST /api/auth/register
  register: adminProcedure // <-- Alterado para adminProcedure
    .input(createUserSchema) // Usa o schema validado
    .mutation(async ({ input, ctx }) => { // ctx agora está disponível
      console.log("[tRPC auth.register] Iniciando registro. Input:", input);
      try {
        await connectToDatabase();
        console.log("[tRPC auth.register] DB Conectado.");

        // Verificar se o email já existe
        const existingUser = await User.findOne({ email: input.email });
        if (existingUser) {
           console.warn(`[tRPC auth.register] Email já existe: ${input.email}`);
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Email já cadastrado',
          });
        }
        console.log(`[tRPC auth.register] Email disponível: ${input.email}`);

        // Hash da senha
         console.log("[tRPC auth.register] Hashing password...");
        const hashedPassword = await hash(input.password, 12); // Usar 12 rounds

        // Validar e converter IDs de empreendimento
        let assignedEmpreendimentoObjectIds: Types.ObjectId[] = [];
        if (input.role === 'user' && input.assignedEmpreendimentos?.length) {
             console.log("[tRPC auth.register] Validando empreendimentos para usuário:", input.assignedEmpreendimentos);
            const validIds = input.assignedEmpreendimentos.every(id => mongoose.isValidObjectId(id));
            if (!validIds) {
                 console.error("[tRPC auth.register] IDs de empreendimento inválidos recebidos.");
                 throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais IDs de empreendimento são inválidos' });
            }
            assignedEmpreendimentoObjectIds = input.assignedEmpreendimentos.map(id => new Types.ObjectId(id));

            // Verificar se empreendimentos existem
             console.log("[tRPC auth.register] Verificando existência dos empreendimentos...");
            const existingCount = await Empreendimento.countDocuments({ _id: { $in: assignedEmpreendimentoObjectIds } });
            if (existingCount !== assignedEmpreendimentoObjectIds.length) {
                console.error("[tRPC auth.register] Um ou mais empreendimentos atribuídos não existem.");
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais empreendimentos atribuídos não existem.' });
            }
            console.log("[tRPC auth.register] Empreendimentos validados.");
        }

        // Criar novo usuário com dados validados
        const userData: any = { // Use 'any' temporarily or define a more precise creation type
            name: input.name,
            email: input.email,
            password: hashedPassword,
            role: input.role,
            assignedEmpreendimentos: input.role === 'user' ? assignedEmpreendimentoObjectIds : [], // Limpa para admin/manager
            // Adiciona preferências padrão
            notificationPreferences: {
                emailDespesasVencer: true,
                emailDocumentosNovos: true,
                emailRelatoriosSemanais: false,
                systemDespesasVencer: true,
                systemDocumentosNovos: true,
                systemEventosCalendario: true,
                antecedenciaVencimento: 3,
            },
            preferences: {
                language: 'pt-BR',
                dateFormat: 'dd/MM/yyyy',
                currency: 'BRL',
            },
            // createdAt e updatedAt são gerenciados pelo Mongoose { timestamps: true }
        };

        console.log("[tRPC auth.register] Criando usuário com dados:", JSON.stringify(userData, null, 2));
        const newUser = await User.create(userData);
        console.log(`[tRPC auth.register] Usuário criado com ID: ${newUser._id}`);

        return {
          success: true,
          message: 'Usuário criado com sucesso',
          user: { // Retorna dados seguros
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            assignedEmpreendimentos: newUser.assignedEmpreendimentos?.map(id => id.toString()) || [],
          },
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
  // Não é chamado diretamente pelo cliente via tRPC para login.
  // O login real acontece via POST para /api/auth/callback/credentials
  verifyCredentials: publicProcedure // Deve ser público para NextAuth usar
    .input(loginSchema)
    .query(async ({ input }) => { // Query é mais apropriado aqui, não muda o estado
       // console.log(`[tRPC verifyCredentials] Verificando: ${input.email}`);
      try {
        await connectToDatabase();

        // Buscar usuário pelo email
        const user = await User.findOne({ email: input.email }).lean(); // Use lean for performance
        if (!user) {
          // console.warn(`[tRPC verifyCredentials] Usuário não encontrado: ${input.email}`);
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }
        if (!user.password) {
           // console.warn(`[tRPC verifyCredentials] Usuário sem senha: ${input.email}`);
           throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Conta inválida' });
        }

        // Verificar senha
        const passwordValid = await compare(input.password, user.password);
        if (!passwordValid) {
           // console.warn(`[tRPC verifyCredentials] Senha inválida para: ${input.email}`);
           throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        // console.log(`[tRPC verifyCredentials] Credenciais OK para: ${input.email}`);
        // Retorna os dados necessários para a sessão NextAuth
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          assignedEmpreendimentos: user.assignedEmpreendimentos?.map(id => id.toString()) || [],
        };
      } catch (error) {
        // Não relança TRPCError aqui para evitar expor detalhes no authorize
        console.error('[tRPC verifyCredentials] Erro:', error);
        throw new Error('Falha na verificação de credenciais'); // Lança erro genérico para NextAuth
      }
    }),

  // Procedimento para obter dados do usuário logado atualmente
  me: protectedProcedure // Requer autenticação
    .query(async ({ ctx }) => {
      console.log(`[tRPC auth.me] Buscando dados para usuário ID: ${ctx.user.id}`);
      try {
        await connectToDatabase();
        // ctx.user é populado pelo middleware isAuthenticated
        const userId = ctx.user.id;
        const user = await User.findById(userId)
          .select('-password') // Exclui a senha
          .lean(); // Use lean

        if (!user) {
           console.error(`[tRPC auth.me] Usuário não encontrado no DB: ${userId}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }
        console.log(`[tRPC auth.me] Dados encontrados para: ${user.email}`);

        // Retorna dados seguros do usuário logado
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          notificationPreferences: user.notificationPreferences,
          preferences: user.preferences,
          assignedEmpreendimentos: user.assignedEmpreendimentos?.map(id => id.toString()) || [],
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC auth.me] Erro:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar dados do usuário' });
      }
    }),
});
