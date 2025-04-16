// server/api/routers/users.ts
import { router, protectedProcedure, adminProcedure, superAdminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createUserSchema,
    updateUserSchema,
    userResponseSchema,
    adminUpdatePasswordSchema
} from '../schemas/auth'; // Schemas related to user creation/update
import { UserDocument as User, EmpreendimentoDocument as Empreendimento } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import { hash, genSalt } from 'bcryptjs';
import mongoose, { Types, FilterQuery } from 'mongoose';
import type { Context } from '../context';

// Interface UserLean (sem alterações)
interface UserLean {
  _id: Types.ObjectId; name: string; email: string; role: 'admin' | 'manager' | 'user'; avatarUrl?: string; notificationPreferences?: any; preferences?: any; assignedEmpreendimentos?: Types.ObjectId[]; createdAt: Date; updatedAt: Date;
}
// Interface EmpreendimentoLean (sem alterações)
interface EmpreendimentoLean { _id: string; name: string; }
// Interface ClientUser (sem alterações)
interface ClientUser { _id: string; name: string; email: string; role: 'admin' | 'manager' | 'user'; avatarUrl?: string | null; notificationPreferences?: UserLean['notificationPreferences']; preferences?: UserLean['preferences']; assignedEmpreendimentos: EmpreendimentoLean[]; createdAt: string; updatedAt: string; }
// Interface UserListResponse (sem alterações)
interface UserListResponse { users: ClientUser[]; pagination: { total: number; limit: number; page: number; pages: number; hasMore: boolean; }; }

/**
 * Roteador para usuários
 */
export const usersRouter = router({
  // --- getAll (sem alterações) ---
  getAll: adminProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(10), searchTerm: z.string().optional(), }))
    .query(async ({ input }): Promise<UserListResponse> => { console.log("[tRPC usersRouter.getAll] Input:", input);
        try { 

            await connectToDatabase();
            const { page, limit, searchTerm } = input; const skip = (page - 1) * limit;
            const filter: FilterQuery<UserLean> = {};
            if (searchTerm) { const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [ { name: { $regex: escapedSearchTerm, $options: 'i' } }, { email: { $regex: escapedSearchTerm, $options: 'i' } }, ]; }
            console.log("[tRPC getAll] Filtro:", JSON.stringify(filter));
            const [usersDocs, total] = await Promise.all([ User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean<UserLean[]>(), User.countDocuments(filter) ]);
           console.log(`[tRPC getAll] Users: ${usersDocs.length}, Total: ${total}`);
            const empreendimentoIds = usersDocs.flatMap(u => u.assignedEmpreendimentos || []).filter(id => id);
            const uniqueEmpIds = [...new Set(empreendimentoIds.map(id => id.toString()))];
            let empreendimentosMap: Map<string, string> = new Map();
            if (uniqueEmpIds.length > 0) { const empreendimentos = await Empreendimento.find({ _id: { $in: uniqueEmpIds.map(id => new Types.ObjectId(id)) } }).select('_id name').lean(); empreendimentosMap = new Map(empreendimentos.map(e => [e._id.toString(), e.name])); console.log(`[tRPC getAll] Nomes empreendimentos carregados.`);}
            const clientUsers: ClientUser[] = usersDocs.map(user => ({ _id: user._id.toString(), name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl ?? null, notificationPreferences: user.notificationPreferences, preferences: user.preferences, assignedEmpreendimentos: (user.assignedEmpreendimentos || []).map(id => id.toString()).map(idStr => ({ _id: idStr, name: empreendimentosMap.get(idStr) || 'Desconhecido' })).filter(emp => emp.name !== 'Desconhecido'), createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), }));
            return { users: clientUsers, pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total, }, };
        } catch (error) { console.error('Erro listar usuários tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar usuários', }); }
    }),
  // --- getById (sem alterações) ---
  getById: superAdminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID inválido' }), }))
    .output(userResponseSchema).query(async ({ input, ctx }) => {
        console.log(`[tRPC getById] ID: ${input.id}`);
        try {
          await connectToDatabase();
            if (ctx.user.role !== 'admin' && ctx.user.id !== input.id) { throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' }); }
            const user = await User.findById(input.id).select('-password').lean<UserLean | null>();
            if (!user) { throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' }); }
            console.log(`[tRPC getById] User found: ${user.email}`);
            let assignedEmpreendimentos: EmpreendimentoLean[] = [];
            if (user.assignedEmpreendimentos && user.assignedEmpreendimentos.length > 0) { const validEmpIds = user.assignedEmpreendimentos.filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id)); if (validEmpIds.length > 0) { const empreendimentos = await Empreendimento.find({ _id: { $in: validEmpIds } }).select('_id name').lean(); assignedEmpreendimentos = empreendimentos.map(emp => ({ _id: emp._id.toString(), name: emp.name, })); }}
            return userResponseSchema.parse({ _id: user._id.toString(), name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl ?? null, notificationPreferences: user.notificationPreferences, preferences: user.preferences, assignedEmpreendimentos, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), });
        } catch (error) { if (error instanceof TRPCError) throw error; console.error('[tRPC getById] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar usuário' }); }
    }),

  // --- update (CORRIGIDO) ---
  update: superAdminProcedure
    .input(z.object({
      id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID de usuário inválido' }),
      data: updateUserSchema,
    }))
    .mutation(async ({ input, ctx }) => { console.log(`[tRPC usersRouter.update] ID: ${input.id}, Data:`, JSON.stringify(input.data));
      if (ctx.user.id === input.id) { 
           throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use a página de perfil para editar seus dados.' });
      }
      try {
        await connectToDatabase();
        const userToUpdate = await User.findById(input.id);
        if (!userToUpdate) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário alvo não encontrado' });
        }
        console.log(`[tRPC update] User encontrado: ${userToUpdate.email}`);

        // Preparar dados para $set
        const updatePayload: Partial<UserLean> = { updatedAt: new Date() };
        if (input.data.name !== undefined) updatePayload.name = input.data.name;
        if (input.data.role !== undefined) updatePayload.role = input.data.role;
        // Avatar URL seria tratado em outra mutation ou endpoint que lida com upload
        // Lógica para assignedEmpreendimentos
        const targetRole = input.data.role ?? userToUpdate.role; // Role final
        if (input.data.assignedEmpreendimentos !== undefined) { // Se o array foi enviado no input
            if (targetRole === 'user') {

                // *** CORREÇÃO AQUI: Converter strings para ObjectIds ***
                const assignedObjectIds = input.data.assignedEmpreendimentos.map(id => new Types.ObjectId(id));
                updatePayload.assignedEmpreendimentos = assignedObjectIds; // Atribui o array de ObjectIds

                console.log("[tRPC update] Empreendimentos validados (ObjectId):", updatePayload.assignedEmpreendimentos);
                const existingCount = await Empreendimento.countDocuments({ _id: { $in: assignedObjectIds } });
                if (existingCount !== assignedObjectIds.length) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais empreendimentos não existem.' });
                }
            } else {
                // Limpar para admin/manager se o array foi explicitamente enviado (mesmo que vazio)
                updatePayload.assignedEmpreendimentos = [];
                console.log("[tRPC update] Limpando empreendimentos para role:", targetRole);
            }
        } else if (input.data.role && input.data.role !== 'user' && userToUpdate.role === 'user') {
            // Limpar se a role mudou DE user PARA não-user e o array não foi enviado
            updatePayload.assignedEmpreendimentos = [];
            console.log("[tRPC update] Limpando empreendimentos ao mudar role de user para:", input.data.role);
        }
        // Se assignedEmpreendimentos não foi enviado E a role não mudou de 'user', não faz nada com o campo

        console.log("[tRPC usersRouter.update] Payload para $set:", JSON.stringify(updatePayload));
        const updatedUser = await User.findByIdAndUpdate(
          input.id,
          { $set: updatePayload },
          { new: true, runValidators: true }
        ).select('-password').lean<UserLean | null>();

        if (!updatedUser) { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar usuário no banco' }); }
        console.log(`[tRPC update] Usuário ${input.id} atualizado.`);

        // Popular empreendimentos para a resposta
       let assignedEmpreendimentosResp: EmpreendimentoLean[] = [];
        if (updatedUser.assignedEmpreendimentos && updatedUser.assignedEmpreendimentos.length > 0) {
            const empDocs = await Empreendimento.find({ _id: { $in: updatedUser.assignedEmpreendimentos } }).select('_id name').lean();
            assignedEmpreendimentosResp = empDocs.map(e => ({ _id: e._id.toString(), name: e.name }));
        }

        return {
          success: true,
          message: 'Usuário atualizado com sucesso',
          user: userResponseSchema.parse({ // Validar resposta
              _id: updatedUser._id.toString(), name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, avatarUrl: updatedUser.avatarUrl ?? null, notificationPreferences: updatedUser.notificationPreferences, preferences: updatedUser.preferences, assignedEmpreendimentos: assignedEmpreendimentosResp, createdAt: updatedUser.createdAt.toISOString(), updatedAt: updatedUser.updatedAt.toISOString(),
           })
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
         if (error instanceof mongoose.Error.ValidationError) { console.error("[tRPC update] Erro Validação:", error.errors); throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error }); }
        console.error('[tRPC usersRouter.update] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar usuário' });
      }
    }),

      create: superAdminProcedure
    .input(createUserSchema)
    .mutation(async ({ input }) => {
      console.log(`[tRPC usersRouter.create] Data:`, JSON.stringify(input));
      try { 
        await connectToDatabase();
        const user = await User.findOne({ email: input.email });
        if (user) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um usuário com este e-mail.' });
        }
        const salt = await genSalt(12);
        const passwordHash = await hash(input.password, salt);
        const newUser = new User({ ...input, password: passwordHash, });
        const savedUser = await newUser.save();
        console.log(`[tRPC create] Usuário criado: ${savedUser.email}`);
        return {
          success: true,
          message: 'Usuário criado com sucesso',
        }; } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC usersRouter.create] Erro:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar usuário' });
      }
    }),

  delete: superAdminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID inválido' }) }))
    .mutation(async ({ input, ctx }) => { console.log(`[tRPC delete] ID: ${input.id}, Admin: ${ctx.user.id}`);
      if (ctx.user.id === input.id) { throw new TRPCError({ code: 'FORBIDDEN', message: 'Não pode excluir a si mesmo.' }); } 
    try { 
        await connectToDatabase();
        const userToDelete = await User.findById(input.id);
        if (!userToDelete) { throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' }); }
        console.log(`[tRPC delete] User encontrado: ${userToDelete.email}, Role: ${userToDelete.role}`);
        if (userToDelete.role === 'admin') { const adminCount = await User.countDocuments({ role: 'admin' }); console.log(`[tRPC delete] Admin count: ${adminCount}`); if (adminCount <= 1) { throw new TRPCError({ code: 'FORBIDDEN', message: 'Não pode excluir o último admin.' }); } }
        console.log(`[tRPC delete] Excluindo user ${input.id}...`);
        await User.findByIdAndDelete(input.id); console.log(`[tRPC delete] User ${input.id} excluído.`);
        return { success: true, message: 'Usuário excluído com sucesso' };
      } catch (error) { if (error instanceof TRPCError) throw error; console.error('[tRPC delete] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir usuário' }); }
    }),

    updatePassword: superAdminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)), data: adminUpdatePasswordSchema }))
    .mutation(async ({ input, ctx }) => { console.log(`[tRPC updatePassword] ID Alvo: ${input.id}, Admin: ${ctx.user.id}`);

       if (ctx.user.id === input.id) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use a pág. de perfil.' }); }
       try {
           await connectToDatabase();
           const targetUser = await User.findById(input.id);
           if (!targetUser) { throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário alvo não encontrado' }); }
           console.log(`[tRPC updatePassword] User alvo: ${targetUser.email}. Hashing...`);
           const hashedNewPassword = await hash(input.data.password, 12);
           targetUser.password = hashedNewPassword; targetUser.updatedAt = new Date(); await targetUser.save();
           console.log(`[tRPC updatePassword] Senha user ${input.id} atualizada por admin ${ctx.user.id}.`);
           return { success: true, message: `Senha de ${targetUser.name} atualizada.` };
       } catch (error) { if (error instanceof TRPCError) throw error; console.error('[tRPC updatePassword] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao alterar senha.' }); }
    }),


  getAllEmpreendimentos: superAdminProcedure.query(async ({ }) => { 
    try { await connectToDatabase();
      const empreendimentos = await Empreendimento.find().select('_id name').lean(); return { success: true, message: 'Empreendimentos carregados com sucesso', empreendimentos: empreendimentos, }; }
    catch (e) { if (e instanceof TRPCError) throw e; console.error(`[tRPC getAllEmpreendimentos]`, e); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao carregar empreendimentos' }); }
  }),
  getEmpreendimentosById: superAdminProcedure.input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)), }))
    .query(async ({ input, ctx }) => {
      try {
            await connectToDatabase();
           const { id } = input
        const empreendimento = await Empreendimento.findById(id).select('-password').lean<UserLean | null>();
        if (!empreendimento) { throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' }); }

         return { success: true, message: 'Empreendimento carregado com sucesso', empreendimento: empreendimento };
      } catch (e) { if (e instanceof TRPCError) throw e; console.error(`[tRPC getEmpreendimentosById]`, e); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao carregar empreendimento' }); }
    }),

});

export type UsersRouter = typeof usersRouter;