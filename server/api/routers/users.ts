// ============================================================
// START OF REFACTORED FILE: server/api/routers/users.ts
// (Fixed: TS2339 property 'name' does not exist on type 'ObjectId')
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    updateUserSchema,
    userResponseSchema,
    adminUpdatePasswordSchema
} from '../schemas/auth';
// *** CORREÇÃO: Importar UserDocument e EmpreendimentoDocument de models ***
import { User, Empreendimento, UserDocument, EmpreendimentoDocument } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import { hash } from 'bcryptjs';
import mongoose, { Types, FilterQuery } from 'mongoose';
import type { Context } from '../context';
// *** CORREÇÃO: Importar a interface populada de models ***
import type { EmpreendimentoLeanPopulated } from '@/lib/db/models';

// Interface ClientUser (sem alteração)
interface ClientUser {
    _id: string; name: string; email: string; role: 'superadmin' | 'admin' | 'manager' | 'user';
    avatarUrl?: string | null; notificationPreferences?: any; preferences?: any;
    assignedEmpreendimentos: { _id: string; name: string; }[];
    createdAt: string; updatedAt: string;
}
// Interface UserListResponse (sem alteração)
interface UserListResponse {
    users: ClientUser[];
    pagination: { total: number; limit: number; page: number; pages: number; hasMore: boolean; };
}

export const usersRouter = router({
  // --- Listar usuários DENTRO do tenant ---
  getAll: tenantAdminProcedure
    .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(10),
        searchTerm: z.string().optional(),
    }))
    .query(async ({ input, ctx }): Promise<UserListResponse> => {
        console.log(`[tRPC usersRouter.getAll] Tenant: ${ctx.tenantId!}, Input:`, input);
        const tenantObjectId = new Types.ObjectId(ctx.tenantId!);
        try {
            await connectToDatabase();
            const { page, limit, searchTerm } = input; const skip = (page - 1) * limit;
            const filter: FilterQuery<UserDocument> = { tenantId: tenantObjectId };
            if (searchTerm) {
                const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filter.$or = [ { name: { $regex: escapedSearchTerm, $options: 'i' } }, { email: { $regex: escapedSearchTerm, $options: 'i' } } ];
            }
            console.log("[tRPC getAll Users] Filtro MongoDB:", JSON.stringify(filter));

            const [usersDocs, total] = await Promise.all([
                User.find(filter)
                  .select('-password')
                  // A tipagem no populate ajuda, mas a verificação no map é mais robusta
                  .populate<{ assignedEmpreendimentos: EmpreendimentoLeanPopulated[] }>('assignedEmpreendimentos', '_id name')
                  .sort({ createdAt: -1 })
                  .skip(skip)
                  .limit(limit)
                  .lean<UserDocument[]>(), // O lean retorna UserDocument, que pode ter ObjectIds OU objetos populados
                User.countDocuments(filter)
            ]);
            console.log(`[tRPC getAll Users] Usuários encontrados: ${usersDocs.length}, Total no tenant: ${total}`);

            // Mapeamento para resposta segura com type guard
            const clientUsers: ClientUser[] = usersDocs.map(user => {
                // *** CORREÇÃO: Adiciona type guard dentro do map ***
                const mappedEmpreendimentos = (user.assignedEmpreendimentos || []).map(emp => {
                    // Verifica se 'emp' é um objeto populado (tem _id e name)
                    if (typeof emp === 'object' && emp !== null && '_id' in emp && 'name' in emp && emp._id instanceof Types.ObjectId) {
                        return {
                            _id: emp._id.toString(),
                            name: emp.name,
                        };
                    }
                    // Loga um aviso se não for populado (inesperado aqui, mas seguro)
                    console.warn(`[getAll Users map] Encontrado ObjectId em vez de Empreendimento populado: ${emp?.toString()}`);
                    return null; // Ou poderia buscar o nome separadamente se necessário
                }).filter((emp): emp is { _id: string; name: string; } => emp !== null); // Filtra nulos

                return {
                    _id: user._id.toString(), name: user.name, email: user.email,
                    role: user.role,
                    avatarUrl: user.avatarUrl ?? null,
                    notificationPreferences: user.notificationPreferences, preferences: user.preferences,
                    assignedEmpreendimentos: mappedEmpreendimentos, // Usa o array mapeado com segurança
                    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
                };
            });

            return {
                users: clientUsers,
                pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total, },
            };
        } catch (error) {
            console.error('Erro listar usuários tRPC:', error);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar usuários', });
        }
    }),

  // --- Obter usuário por ID DENTRO do tenant ---
  getById: tenantProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID inválido' }), }))
    .output(userResponseSchema)
    .query(async ({ input, ctx }) => {
       console.log(`[tRPC getById] Req User: ${ctx.user!.id}, Target ID: ${input.id}, Tenant: ${ctx.tenantId!}`);
        const targetUserId = new Types.ObjectId(input.id);
        const requesterTenantId = new Types.ObjectId(ctx.tenantId!);
       try {
           await connectToDatabase();
           const user = await User.findOne({ _id: targetUserId, tenantId: requesterTenantId })
               .select('-password')
               .populate<{ assignedEmpreendimentos: EmpreendimentoLeanPopulated[] }>('assignedEmpreendimentos', '_id name')
               .lean<UserDocument | null>();

           if (!user) {
               throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado neste tenant' });
           }
           console.log(`[tRPC getById] User encontrado: ${user.email}`);

           const canView = ctx.user!.role === 'admin' || ctx.user!.id === input.id;
           if (!canView) {
               console.warn(`[tRPC getById] Usuário ${ctx.user!.id} tentando ver ${input.id} sem permissão.`);
               throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para visualizar este usuário' });
           }

           return userResponseSchema.parse({
                _id: user._id.toString(), name: user.name, email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl ?? null,
                notificationPreferences: user.notificationPreferences, preferences: user.preferences,
                // *** CORREÇÃO: Adiciona type guard aqui também ***
                assignedEmpreendimentos: (user.assignedEmpreendimentos || []).map(emp => {
                    if (typeof emp === 'object' && emp !== null && '_id' in emp && 'name' in emp && emp._id instanceof Types.ObjectId) {
                        return {
                            _id: emp._id.toString(),
                            name: emp.name,
                        };
                    }
                    console.warn(`[getById User map] Encontrado ObjectId em vez de Empreendimento populado: ${emp?.toString()}`);
                    return null;
                }).filter((emp): emp is { _id: string; name: string; } => emp !== null),
                createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
            });
       } catch (error) {
           if (error instanceof TRPCError) throw error;
           console.error('[tRPC getById] Erro:', error);
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar usuário' });
       }
    }),

  // --- Atualizar usuário DENTRO do tenant ---
  update: tenantAdminProcedure
    .input(z.object({
      id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID de usuário inválido' }),
      data: updateUserSchema,
    }))
    .mutation(async ({ input, ctx }) => {
       console.log(`[tRPC usersRouter.update] Admin: ${ctx.user!.id}, Target ID: ${input.id}, Tenant: ${ctx.tenantId!}, Data:`, JSON.stringify(input.data));
       const targetUserId = new Types.ObjectId(input.id);
       const requesterTenantId = new Types.ObjectId(ctx.tenantId!);

      if (ctx.user!.id === input.id) {
           throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use a página de perfil para editar seus próprios dados.' });
      }

      try {
        await connectToDatabase();
        const userToUpdate = await User.findOne({ _id: targetUserId, tenantId: requesterTenantId });
        if (!userToUpdate) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário alvo não encontrado neste tenant' });
        }
        console.log(`[tRPC update] Usuário a ser atualizado encontrado: ${userToUpdate.email}`);

        const updatePayload: Partial<UserDocument> = { updatedAt: new Date() };
        if (input.data.name !== undefined) updatePayload.name = input.data.name;
        if (input.data.role !== undefined) updatePayload.role = input.data.role;

        const targetRole = input.data.role ?? userToUpdate.role;
        if (input.data.assignedEmpreendimentos !== undefined) {
            if (targetRole === 'user') {
                const validIds = input.data.assignedEmpreendimentos.every(id => mongoose.isValidObjectId(id));
                if (!validIds) throw new TRPCError({ code: 'BAD_REQUEST', message: 'IDs de empreendimento inválidos' });
                const assignedObjectIds = input.data.assignedEmpreendimentos.map(id => new Types.ObjectId(id));
                const existingCount = await Empreendimento.countDocuments({ _id: { $in: assignedObjectIds }, tenantId: requesterTenantId });
                if (existingCount !== assignedObjectIds.length) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Um ou mais empreendimentos não existem ou não pertencem a este tenant.' });
                }
                updatePayload.assignedEmpreendimentos = assignedObjectIds;
            } else {
                updatePayload.assignedEmpreendimentos = [];
            }
        } else if (input.data.role && input.data.role !== 'user' && userToUpdate.role === 'user') {
            updatePayload.assignedEmpreendimentos = [];
        }

        console.log("[tRPC usersRouter.update] Payload para $set:", JSON.stringify(updatePayload));
        const updatedUser = await User.findOneAndUpdate(
          { _id: targetUserId, tenantId: requesterTenantId },
          { $set: updatePayload },
          { new: true, runValidators: true }
        ).select('-password').lean<UserDocument | null>();

        if (!updatedUser) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar usuário no banco' });
        }
        console.log(`[tRPC update] Usuário ${input.id} atualizado no tenant ${ctx.tenantId!}.`);

        let assignedEmpreendimentosResp: { _id: string; name: string; }[] = [];
        if (updatedUser.assignedEmpreendimentos && updatedUser.assignedEmpreendimentos.length > 0) {
             // Busca nomes separadamente, pois findOneAndUpdate não popula da mesma forma
             const empIds = updatedUser.assignedEmpreendimentos.map(id => id.toString()); // Pega IDs (podem ser ObjectId)
             const empDocs = await Empreendimento.find({ _id: { $in: empIds } }).select('_id name').lean<EmpreendimentoLeanPopulated[]>();
             assignedEmpreendimentosResp = empDocs.map(e => ({
                 _id: e._id.toString(),
                 name: e.name
             }));
        }

        return {
          success: true,
          message: 'Usuário atualizado com sucesso',
          user: userResponseSchema.parse({
              _id: updatedUser._id.toString(), name: updatedUser.name, email: updatedUser.email,
              role: updatedUser.role,
              avatarUrl: updatedUser.avatarUrl ?? null,
              notificationPreferences: updatedUser.notificationPreferences, preferences: updatedUser.preferences,
              assignedEmpreendimentos: assignedEmpreendimentosResp, // Usa o array buscado
              createdAt: updatedUser.createdAt.toISOString(), updatedAt: updatedUser.updatedAt.toISOString(),
           })
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
         if (error instanceof mongoose.Error.ValidationError) { console.error("[tRPC update] Erro Validação:", error.errors); throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error }); }
        console.error('[tRPC usersRouter.update] Erro:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar usuário' });
      }
    }),

  // --- delete (sem alterações na lógica principal, apenas nos checks de ctx.user!) ---
  delete: tenantAdminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID inválido' }) }))
    .mutation(async ({ input, ctx }) => {
       console.log(`[tRPC delete] Admin: ${ctx.user!.id}, Target ID: ${input.id}, Tenant: ${ctx.tenantId!}`);
       const targetUserId = new Types.ObjectId(input.id);
       const requesterTenantId = new Types.ObjectId(ctx.tenantId!);

      if (ctx.user!.id === input.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível excluir a si mesmo.' });
      }

      try {
        await connectToDatabase();
        const userToDelete = await User.findOne({ _id: targetUserId, tenantId: requesterTenantId });
        if (!userToDelete) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado neste tenant' });
        }
        console.log(`[tRPC delete] Usuário a ser excluído encontrado: ${userToDelete.email}, Role: ${userToDelete.role}`);

        if (userToDelete.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', tenantId: requesterTenantId });
            console.log(`[tRPC delete] Contagem de admins no tenant ${requesterTenantId}: ${adminCount}`);
            if (adminCount <= 1) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível excluir o último administrador do tenant.' });
            }
        }

        console.log(`[tRPC delete] Excluindo usuário ${input.id} do tenant ${ctx.tenantId!}...`);
        await User.findOneAndDelete({ _id: targetUserId, tenantId: requesterTenantId });
        console.log(`[tRPC delete] Usuário ${input.id} excluído do tenant ${ctx.tenantId!}.`);

        return { success: true, message: 'Usuário excluído com sucesso' };
      } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error('[tRPC delete] Erro:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir usuário' });
      }
    }),

   // --- updatePassword (sem alterações na lógica principal, apenas nos checks de ctx.user!) ---
   updatePassword: tenantAdminProcedure
    .input(z.object({
        id: z.string().refine(id => mongoose.isValidObjectId(id)),
        data: adminUpdatePasswordSchema
    }))
    .mutation(async ({ input, ctx }) => {
       console.log(`[tRPC updatePassword] Admin: ${ctx.user!.id}, Target ID: ${input.id}, Tenant: ${ctx.tenantId!}`);
       const targetUserId = new Types.ObjectId(input.id);
       const requesterTenantId = new Types.ObjectId(ctx.tenantId!);

       if (ctx.user!.id === input.id) {
           throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use a página de perfil para alterar sua própria senha.' });
       }

       try {
           await connectToDatabase();
           const targetUser = await User.findOne({ _id: targetUserId, tenantId: requesterTenantId });
           if (!targetUser) {
               throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário alvo não encontrado neste tenant' });
           }
           console.log(`[tRPC updatePassword] Usuário alvo encontrado: ${targetUser.email}. Hashing nova senha...`);

           const hashedNewPassword = await hash(input.data.password, 12);
           targetUser.password = hashedNewPassword;
           targetUser.updatedAt = new Date();
           await targetUser.save();

           console.log(`[tRPC updatePassword] Senha do usuário ${input.id} atualizada por admin ${ctx.user!.id} no tenant ${ctx.tenantId!}.`);
           return { success: true, message: `Senha de ${targetUser.name} atualizada com sucesso.` };
       } catch (error) {
           if (error instanceof TRPCError) throw error;
           console.error('[tRPC updatePassword] Erro:', error);
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao alterar senha do usuário.' });
       }
    }),

});

export type UsersRouter = typeof usersRouter;
// ============================================================
// END OF REFACTORED FILE: server/api/routers/users.ts
// ============================================================