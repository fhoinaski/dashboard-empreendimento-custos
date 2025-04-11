// ============================================================
// NEW FILE: server/api/routers/tenants.router.ts
// ============================================================
import { router, superAdminProcedure } from '../trpc'; // Procedimento restrito ao Super Admin
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db/mongodb';
import { Tenant, User, AppSettings, TenantDocument } from '@/lib/db/models';
import { TenantService } from '@/server/services/tenant.service';
import {
    listTenantsFilterSchema,
    updateTenantStatusInputSchema,
    createTenantWithAdminInputSchema,
    tenantListResponseSchema,
    simpleSuccessResponseSchema,
    createTenantResponseSchema,
    tenantListItemSchema, // Importar o schema do item individual
    integrationSettingsStatusSchema, // Importar schema de integração
    tenantAdminInfoSchema, // Importar schema de info do admin
} from '../schemas/tenants';
import mongoose, { FilterQuery, PipelineStage } from 'mongoose';
import type { Context } from '../context';

const tenantService = new TenantService();

export const tenantsRouter = router({
    // Listar Tenants (Super Admin)
    listTenants: superAdminProcedure
        .input(listTenantsFilterSchema)
        .output(tenantListResponseSchema)
        .query(async ({ input }): Promise<z.infer<typeof tenantListResponseSchema>> => {
            console.log('[tRPC tenants.listTenants] Input:', input);
            try {
                await connectToDatabase();
                const { page, limit, status, search, sortBy, sortOrder } = input;
                const skip = (page - 1) * limit;
                const filter: FilterQuery<TenantDocument> = {};

                if (status) filter.status = status;
                if (search) {
                    const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    filter.$or = [
                        { name: { $regex: esc, $options: 'i' } },
                        { slug: { $regex: esc, $options: 'i' } }
                    ];
                }

                const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
                if (sortBy !== '_id') sortCriteria['_id'] = -1;

                // Pipeline para buscar tenants e agregar dados relacionados
                const pipeline: PipelineStage[] = [
                    { $match: filter },
                    { $sort: sortCriteria },
                    { $skip: skip },
                    { $limit: limit },
                    // Buscar admin principal (o primeiro usuário 'admin' do tenant)
                    {
                        $lookup: {
                            from: 'users', // Collection name for User model
                            localField: '_id',
                            foreignField: 'tenantId',
                            pipeline: [
                                { $match: { role: 'admin' } }, // Busca apenas admins
                                { $sort: { createdAt: 1 } }, // Pega o mais antigo (geralmente o primeiro)
                                { $limit: 1 },
                                { $project: { _id: 1, email: 1, name: 1 } } // Campos necessários
                            ],
                            as: 'adminUser'
                        }
                    },
                    // Buscar contagem de usuários
                    {
                        $lookup: {
                            from: 'users',
                            localField: '_id',
                            foreignField: 'tenantId',
                            as: 'tenantUsers'
                        }
                    },
                    // Buscar configurações de integração
                    {
                        $lookup: {
                            from: 'appsettings', // Collection name for AppSettings
                            localField: '_id',
                            foreignField: 'tenantId', // ou '_id' se AppSettings._id == Tenant._id
                            pipeline: [
                                { $limit: 1 },
                                { $project: { googleDriveEnabled: 1, googleSheetsEnabled: 1, googleServiceAccountJsonEncrypted: 1 } }
                            ],
                            as: 'settings'
                        }
                    },
                     // Desconstruir arrays de lookups (pegar o primeiro elemento ou default)
                     { $unwind: { path: '$adminUser', preserveNullAndEmptyArrays: true } },
                     { $unwind: { path: '$settings', preserveNullAndEmptyArrays: true } },
                     // Projetar o resultado final
                     {
                         $project: {
                             _id: 1, name: 1, slug: 1, status: 1, createdAt: 1, updatedAt: 1,
                             admin: '$adminUser', // Renomear para schema
                             userCount: { $size: '$tenantUsers' },
                             integrationSettings: {
                                 googleDriveEnabled: { $ifNull: ["$settings.googleDriveEnabled", false] },
                                 googleSheetsEnabled: { $ifNull: ["$settings.googleSheetsEnabled", false] },
                                 googleServiceAccountConfigured: { $cond: { if: { $gt: ["$settings.googleServiceAccountJsonEncrypted", null] }, then: true, else: false } }
                             }
                         }
                     }
                ];

                const [tenantsData, total] = await Promise.all([
                    Tenant.aggregate(pipeline),
                    Tenant.countDocuments(filter)
                ]);

                console.log(`[tRPC tenants.listTenants] Tenants agregados: ${tenantsData.length}, Total no DB: ${total}`);

                // Mapear e validar cada item individualmente antes de validar a resposta final
                const validatedTenants = tenantsData.map(t => tenantListItemSchema.parse({
                    ...t,
                    _id: t._id.toString(),
                    createdAt: t.createdAt?.toISOString(),
                    updatedAt: t.updatedAt?.toISOString(),
                    admin: t.admin ? { // Validar sub-documento admin
                       ...t.admin,
                       _id: t.admin._id.toString(),
                    } : null,
                    integrationSettings: integrationSettingsStatusSchema.parse(t.integrationSettings || {}) // Validar sub-documento settings
                }));

                const response = {
                    tenants: validatedTenants,
                    pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total }
                };

                return tenantListResponseSchema.parse(response); // Validar a estrutura final

            } catch (error: any) {
                console.error('[tRPC tenants.listTenants] Erro:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao listar tenants',
                    cause: error.message,
                });
            }
        }),

    // Criar Tenant (Super Admin)
    createTenant: superAdminProcedure
        .input(createTenantWithAdminInputSchema)
        .output(createTenantResponseSchema)
        .mutation(async ({ input }): Promise<z.infer<typeof createTenantResponseSchema>> => {
            console.log('[tRPC tenants.createTenant] Iniciando criação com input:', { tenantName: input.tenantName, adminEmail: input.adminEmail });
            try {
                const result = await tenantService.createTenantWithAdmin(input);
                console.log('[tRPC tenants.createTenant] Resultado do serviço:', result);

                if (!result.success) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST', // Ou INTERNAL_SERVER_ERROR dependendo da causa
                        message: result.message,
                        cause: result.error,
                    });
                }

                // Validar e retornar
                return createTenantResponseSchema.parse(result);

            } catch (error: any) {
                console.error('[tRPC tenants.createTenant] Erro:', error);
                 if (error instanceof TRPCError) throw error;
                 return createTenantResponseSchema.parse({
                     success: false,
                     message: 'Erro interno ao criar tenant.',
                     error: error.message,
                 });
            }
        }),

    // Atualizar Status do Tenant (Super Admin)
    updateStatus: superAdminProcedure
        .input(updateTenantStatusInputSchema)
        .output(simpleSuccessResponseSchema)
        .mutation(async ({ input }): Promise<z.infer<typeof simpleSuccessResponseSchema>> => {
            console.log(`[tRPC tenants.updateStatus] ID: ${input.tenantId}, Novo Status: ${input.status}`);
            try {
                const success = await tenantService.updateTenantStatus(input.tenantId, input.status);
                if (!success) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado ou falha na atualização.' });
                }
                console.log(`[tRPC tenants.updateStatus] Status atualizado com sucesso.`);
                return { success: true, message: 'Status do tenant atualizado.' };
            } catch (error: any) {
                console.error('[tRPC tenants.updateStatus] Erro:', error);
                 if (error instanceof TRPCError) throw error;
                 return simpleSuccessResponseSchema.parse({
                     success: false,
                     message: 'Erro ao atualizar status do tenant.',
                     error: error.message,
                 });
            }
        }),

    // TODO: Adicionar procedures para:
    // getTenantDetails (buscar detalhes, logs, settings) - superAdminProcedure
    // updateTenantSettings (atualizar integrações, etc.) - superAdminProcedure
    // manageTenantAdmins (listar, criar, remover admins de um tenant) - superAdminProcedure

});

export type TenantsRouter = typeof tenantsRouter;
// ============================================================
// END OF ROUTER FILE
// ============================================================