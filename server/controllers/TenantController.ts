
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { TenantService } from '../services/TenantService'; // Renomeado de organizacao.service
import {
    listTenantsFilterSchema,
    updateTenantStatusInputSchema,
    createTenantWithAdminInputSchema,
    tenantListResponseSchema,
    simpleSuccessResponseSchema,
    createTenantResponseSchema,
    TenantListResponse, // Importar o tipo da resposta completa
    TenantListItem,     // Importar o tipo do item individual
    tenantListItemSchema, // Importar o schema do item individual
    integrationSettingsStatusSchema, // Importar schema de integração
    tenantAdminInfoSchema, // Importar schema de info do admin
} from '../api/schemas/tenants'; // Ajuste o caminho se necessário
import type { Context } from '../api/context';
import mongoose, { PipelineStage, FilterQuery } from 'mongoose';
import { Tenant } from '@/lib/db/models'; // Importar Tenant model para agregação aqui

export class TenantController {
    private tenantService: TenantService;

    constructor() {
        this.tenantService = new TenantService();
    }

    /**
     * Lista tenants com base nos filtros e paginação.
     * Executa a agregação para buscar dados adicionais (admin, user count, settings).
     */
    async list(
        input: z.infer<typeof listTenantsFilterSchema>,
        _ctx: Context // Contexto não usado diretamente aqui, mas disponível se necessário
    ): Promise<TenantListResponse> { // Retorna o tipo completo
        console.log('[TenantController.list] Input:', input);
        try {
            const { page, limit, status, search, sortBy, sortOrder } = input;
            const skip = (page - 1) * limit;
            const filter: FilterQuery<any> = {}; // Usar any aqui para filtro Mongoose

            if (status) filter.status = status;
            if (search) {
                const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                filter.$or = [
                    { name: { $regex: esc, $options: 'i' } },
                    { slug: { $regex: esc, $options: 'i' } }
                ];
            }

            const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
            if (sortBy !== '_id') sortCriteria['_id'] = -1; // Critério de desempate

            // Pipeline de agregação (movida do router para cá)
            const pipeline: PipelineStage[] = [
                { $match: filter },
                { $sort: sortCriteria },
                { $skip: skip },
                { $limit: limit },
                { $lookup: { from: 'users', localField: '_id', foreignField: 'tenantId', pipeline: [{ $match: { role: 'admin' } }, { $sort: { createdAt: 1 } }, { $limit: 1 }, { $project: { _id: 1, email: 1, name: 1 } }], as: 'adminUser' } },
                { $lookup: { from: 'users', localField: '_id', foreignField: 'tenantId', as: 'tenantUsers' } },
                { $lookup: { from: 'appsettings', localField: '_id', foreignField: 'tenantId', pipeline: [{ $limit: 1 }, { $project: { googleDriveEnabled: 1, googleSheetsEnabled: 1, googleServiceAccountJsonEncrypted: 1 } }], as: 'settings' } },
                { $unwind: { path: '$adminUser', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$settings', preserveNullAndEmptyArrays: true } },
                { $project: { _id: 1, name: 1, slug: 1, status: 1, createdAt: 1, updatedAt: 1, admin: '$adminUser', userCount: { $size: '$tenantUsers' }, integrationSettings: { googleDriveEnabled: { $ifNull: ["$settings.googleDriveEnabled", false] }, googleSheetsEnabled: { $ifNull: ["$settings.googleSheetsEnabled", false] }, googleServiceAccountConfigured: { $cond: { if: { $ne: ["$settings.googleServiceAccountJsonEncrypted", null] }, then: true, else: false } } } } }
            ];

             // Executar agregação e contagem total
            const [tenantsData, total] = await Promise.all([
                Tenant.aggregate(pipeline),
                Tenant.countDocuments(filter)
            ]);
            console.log(`[TenantController.list] Tenants agregados: ${tenantsData.length}, Total: ${total}`);


            // Validar e formatar a resposta
             // Mapear e validar cada item individualmente
            const validatedTenants = tenantsData.map(t => tenantListItemSchema.parse({
                ...t,
                _id: t._id.toString(),
                createdAt: t.createdAt?.toISOString(),
                updatedAt: t.updatedAt?.toISOString(),
                 // Validar admin corretamente (pode ser null)
                 admin: t.admin ? tenantAdminInfoSchema.parse({
                     ...t.admin,
                     _id: t.admin._id.toString(),
                 }) : null,
                 integrationSettings: integrationSettingsStatusSchema.parse(t.integrationSettings || {})
             }));


            const response = {
                tenants: validatedTenants,
                pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total }
            };

            // Validar a resposta completa
            return tenantListResponseSchema.parse(response);

        } catch (error: any) {
            console.error('[TenantController.list] Erro:', error);
            // Log detalhado do erro aqui, se necessário
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Erro ao buscar lista de tenants.',
                cause: error.message,
            });
        }
    }

    /**
     * Cria um novo tenant e seu admin principal.
     */
    async create(
        input: z.infer<typeof createTenantWithAdminInputSchema>,
        _ctx: Context // Não usado diretamente, mas disponível
    ): Promise<z.infer<typeof createTenantResponseSchema>> {
        console.log('[TenantController.create] Input:', { tenantName: input.tenantName, adminEmail: input.adminEmail });
        try {
            // A validação Zod já ocorreu no router tRPC
            // Chama o serviço para executar a lógica de criação
            const result = await this.tenantService.createTenantWithAdmin(input);

            if (!result.success) {
                 // Lança erro TRPC baseado na mensagem do serviço
                throw new TRPCError({ code: 'BAD_REQUEST', message: result.message, cause: result.error });
            }

            // Valida a resposta do serviço com o schema de output
            return createTenantResponseSchema.parse(result);

        } catch (error: any) {
            console.error('[TenantController.create] Erro:', error);
            if (error instanceof TRPCError) throw error; // Re-throw erros TRPC
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Falha ao criar tenant.',
                cause: error.message,
            });
        }
    }

    /**
     * Atualiza o status de um tenant específico.
     */
    async updateStatus(
        input: z.infer<typeof updateTenantStatusInputSchema>,
        _ctx: Context // Não usado diretamente, mas disponível
    ): Promise<z.infer<typeof simpleSuccessResponseSchema>> {
        console.log('[TenantController.updateStatus] Input:', input);
        try {
            // Chama o serviço para atualizar o status
            const success = await this.tenantService.updateTenantStatus(input.tenantId, input.status);

            if (!success) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado ou falha ao atualizar status.' });
            }

             // Valida a resposta com o schema de output
             return simpleSuccessResponseSchema.parse({
                 success: true,
                 message: 'Status do tenant atualizado com sucesso.'
             });

        } catch (error: any) {
            console.error('[TenantController.updateStatus] Erro:', error);
            if (error instanceof TRPCError) throw error; // Re-throw erros TRPC
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Falha ao atualizar status do tenant.',
                cause: error.message,
            });
        }
    }
}
