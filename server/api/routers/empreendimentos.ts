// FILE: server/api/routers/empreendimentos.ts (Corrigido)
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createEmpreendimentoSchema,
    deleteEmpreendimentoSchema,
    empreendimentoFilterSchema,
    empreendimentoListResponseSchema,
    empreendimentoResponseSchema,
    updateEmpreendimentoSchema,
    type CreateEmpreendimentoInput,
    type DeleteEmpreendimentoInput,
    type UpdateEmpreendimentoInput,
} from '../schemas/empreendimentos';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Documento, Empreendimento, EmpreendimentoDocument, User } from '@/lib/db/models';
import { createEmpreendimentoFolders } from '@/lib/google/drive';
import { createEmpreendimentoSheet } from '@/lib/google/sheets'; // Import corrigido
import mongoose, { FilterQuery, PipelineStage, Types } from 'mongoose';
import type { Context } from '../context';
import { format, isValid as isDateValid, parseISO } from 'date-fns';

// Helpers
const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
    try {
        let d;
        if (!dateInput) return undefined;
        if (dateInput instanceof Date) d = dateInput;
        else d = parseISO(dateInput);
        return isDateValid(d) ? d : undefined;
    } catch {
        return undefined;
    }
};

const isValidHttpUrl = (string: string | null | undefined): boolean => {
    if (!string) return false;
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
};

const buildEmpreendimentoFilter = (inputFilters: z.infer<typeof empreendimentoFilterSchema>, ctxUser: Context['user']): FilterQuery<EmpreendimentoDocument> => {
    if (!ctxUser || !ctxUser.tenantId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário ou tenant não especificado.' });
    }
    const tenantObjectId = new Types.ObjectId(ctxUser.tenantId);
    const filter: FilterQuery<EmpreendimentoDocument> = { tenantId: tenantObjectId };
    const { searchTerm, status, type } = inputFilters;

    if (searchTerm) {
        filter.name = { $regex: searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    if (status && status !== 'todos') filter.status = status;
    if (type && type !== 'todos') filter.type = type;
    if (ctxUser.role === 'user') {
        const assignedIdsString = ctxUser.assignedEmpreendimentos || [];
        const validAssignedObjectIds = assignedIdsString.filter((id) => mongoose.isValidObjectId(id)).map((id) => new Types.ObjectId(id));
        filter._id = { $in: validAssignedObjectIds.length > 0 ? validAssignedObjectIds : [new Types.ObjectId()] };
    }
    return filter;
};

export const empreendimentosRouter = router({
    getAll: protectedProcedure
        .input(empreendimentoFilterSchema)
        .output(empreendimentoListResponseSchema)
        .query(async ({ input, ctx }) => {
            console.log('[tRPC empreendimentos.getAll] Iniciando com input:', JSON.stringify(input));
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
            }

            try {
                await connectToDatabase();
                const { page, limit, sortBy = 'updatedAt', sortOrder = 'desc' } = input;
                const skip = (page - 1) * limit;
                const filter = buildEmpreendimentoFilter(input, ctx.user);

                if (filter._id?.$in && filter._id.$in.length === 1 && filter._id.$in[0].toString() === new Types.ObjectId().toString()) {
                    console.log('[tRPC getAll Empr] Filtro de usuário impossível. Retornando vazio.');
                    return { empreendimentos: [], pagination: { total: 0, limit, page, pages: 0, hasMore: false } };
                }

                const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 };
                console.log('[tRPC getAll Empr] Filtro aplicado:', JSON.stringify(filter));
                console.log('[tRPC getAll Empr] Ordenação:', JSON.stringify(sortCriteria));

                const aggregationPipeline: PipelineStage[] = [
                    { $match: filter },
                    { $lookup: { from: 'despesas', localField: '_id', foreignField: 'empreendimento', as: 'relatedExpenses' } },
                    {
                        $addFields: {
                            pendingExpensesCount: {
                                $size: {
                                    $filter: {
                                        input: '$relatedExpenses',
                                        as: 'expense',
                                        cond: {
                                            $and: [
                                                { $in: ['$$expense.status', ['Pendente', 'A vencer']] },
                                                { $ne: ['$$expense.approvalStatus', 'Rejeitado'] },
                                            ],
                                        },
                                    },
                                },
                            },
                            totalExpensesValue: {
                                $sum: {
                                    $map: {
                                        input: { $filter: { input: '$relatedExpenses', as: 'expense', cond: { $in: ['$$expense.status', ['Pago', 'A vencer']] } } },
                                        as: 'approvedExpense',
                                        in: '$$approvedExpense.value',
                                    },
                                },
                            },
                        },
                    },
                    { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'creatorInfo' } },
                    { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
                    { $sort: sortCriteria },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            address: 1,
                            type: 1,
                            status: 1,
                            totalUnits: 1,
                            soldUnits: 1,
                            startDate: 1,
                            endDate: 1,
                            description: 1,
                            responsiblePerson: 1,
                            contactEmail: 1,
                            contactPhone: 1,
                            image: 1,
                            folderId: 1,
                            sheetId: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            tenantId: 1,
                            createdBy: { _id: '$creatorInfo._id', name: '$creatorInfo.name' },
                            pendingExpensesCount: 1,
                            totalExpensesValue: 1,
                        },
                    },
                ];

                const [empreendimentosDocs, total] = await Promise.all([
                    Empreendimento.aggregate(aggregationPipeline),
                    Empreendimento.countDocuments(filter),
                ]);

                console.log(`[tRPC getAll Empr] Documentos encontrados: ${empreendimentosDocs.length}, Total: ${total}`);

                const clientEmpreendimentos = empreendimentosDocs.map((emp) => {
                    const validImageUrl = isValidHttpUrl(emp.image) ? emp.image : null;
                    if (emp.image && !validImageUrl) {
                        console.warn(`[tRPC getAll Empr] URL de imagem inválida para emp ${emp._id}: "${emp.image}". Retornando null.`);
                    }
                    return {
                        _id: emp._id?.toString() ?? '',
                        name: emp.name ?? 'N/A',
                        address: emp.address ?? 'N/A',
                        type: emp.type ?? 'Residencial',
                        status: emp.status ?? 'Planejamento',
                        totalUnits: typeof emp.totalUnits === 'number' ? emp.totalUnits : 0,
                        soldUnits: typeof emp.soldUnits === 'number' ? emp.soldUnits : 0,
                        startDate: emp.startDate instanceof Date ? emp.startDate.toISOString() : 'N/A',
                        endDate: emp.endDate instanceof Date ? emp.endDate.toISOString() : 'N/A',
                        description: emp.description ?? null,
                        responsiblePerson: emp.responsiblePerson ?? 'N/A',
                        contactEmail: emp.contactEmail ?? 'N/A',
                        contactPhone: emp.contactPhone ?? 'N/A',
                        image: validImageUrl,
                        folderId: emp.folderId ?? undefined,
                        sheetId: emp.sheetId ?? undefined,
                        createdBy: emp.createdBy ? { _id: emp.createdBy._id?.toString() ?? '', name: emp.createdBy.name ?? 'N/A' } : undefined,
                        createdAt: emp.createdAt instanceof Date ? emp.createdAt.toISOString() : 'N/A',
                        updatedAt: emp.updatedAt instanceof Date ? emp.updatedAt.toISOString() : 'N/A',
                        pendingExpenses: typeof emp.pendingExpensesCount === 'number' ? emp.pendingExpensesCount : 0,
                        totalExpenses: typeof emp.totalExpensesValue === 'number' ? emp.totalExpensesValue : 0,
                    };
                });

                const response = {
                    empreendimentos: clientEmpreendimentos,
                    pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total },
                };

                console.log('[tRPC getAll Empr] Resposta validada e retornada.');
                return empreendimentoListResponseSchema.parse(response);
            } catch (error) {
                console.error('[tRPC getAll Empr] Erro:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao listar empreendimentos',
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string().refine((id) => mongoose.isValidObjectId(id), { message: 'ID inválido' }) }))
        .output(empreendimentoResponseSchema)
        .query(async ({ input, ctx }) => {
            console.log(`[tRPC empreendimentos.getById] Buscando ID: ${input.id}`);
            if (!ctx.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
            }
            if (!ctx.user.tenantId) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });
            }

            try {
                await connectToDatabase();
                const tenantId = new Types.ObjectId(ctx.user.tenantId);
                const empreendimentoDoc = await Empreendimento.findOne({ _id: new Types.ObjectId(input.id), tenantId })
                    .populate<{ createdBy: { _id: Types.ObjectId; name: string } | null }>('createdBy', 'name _id')
                    .lean();

                if (!empreendimentoDoc) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado ou pertence a outro tenant' });
                }

                const isAssigned = (ctx.user.assignedEmpreendimentos || []).includes(empreendimentoDoc._id.toString());
                const canView = ctx.user.role === 'admin' || ctx.user.role === 'manager' || (ctx.user.role === 'user' && isAssigned);
                if (!canView) {
                    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para visualizar este empreendimento' });
                }

                console.log(`[tRPC getById Empr] Empreendimento encontrado: ${empreendimentoDoc.name}`);
                const validImageUrl = isValidHttpUrl(empreendimentoDoc.image) ? empreendimentoDoc.image : null;
                if (empreendimentoDoc.image && !validImageUrl) {
                    console.warn(`[tRPC getById Empr] URL de imagem inválida para emp ${empreendimentoDoc._id}: "${empreendimentoDoc.image}". Retornando null.`);
                }

                return empreendimentoResponseSchema.parse({
                    _id: empreendimentoDoc._id?.toString() ?? '',
                    name: empreendimentoDoc.name ?? 'N/A',
                    address: empreendimentoDoc.address ?? 'N/A',
                    type: empreendimentoDoc.type ?? 'Residencial',
                    status: empreendimentoDoc.status ?? 'Planejamento',
                    totalUnits: typeof empreendimentoDoc.totalUnits === 'number' ? empreendimentoDoc.totalUnits : 0,
                    soldUnits: typeof empreendimentoDoc.soldUnits === 'number' ? empreendimentoDoc.soldUnits : 0,
                    startDate: empreendimentoDoc.startDate instanceof Date ? empreendimentoDoc.startDate.toISOString() : 'N/A',
                    endDate: empreendimentoDoc.endDate instanceof Date ? empreendimentoDoc.endDate.toISOString() : 'N/A',
                    description: empreendimentoDoc.description ?? null,
                    responsiblePerson: empreendimentoDoc.responsiblePerson ?? 'N/A',
                    contactEmail: empreendimentoDoc.contactEmail ?? 'N/A',
                    contactPhone: empreendimentoDoc.contactPhone ?? 'N/A',
                    image: validImageUrl,
                    folderId: empreendimentoDoc.folderId ?? undefined,
                    sheetId: empreendimentoDoc.sheetId ?? undefined,
                    createdBy: empreendimentoDoc.createdBy
                        ? { _id: empreendimentoDoc.createdBy._id?.toString() ?? '', name: empreendimentoDoc.createdBy.name ?? 'N/A' }
                        : undefined,
                    createdAt: empreendimentoDoc.createdAt instanceof Date ? empreendimentoDoc.createdAt.toISOString() : 'N/A',
                    updatedAt: empreendimentoDoc.updatedAt instanceof Date ? empreendimentoDoc.updatedAt.toISOString() : 'N/A',
                });
            } catch (error) {
                console.error('[tRPC getById Empr] Erro:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao buscar empreendimento',
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    create: tenantAdminProcedure
        .input(createEmpreendimentoSchema)
        .mutation(async ({ input, ctx }: { input: CreateEmpreendimentoInput; ctx: Context }) => {
            console.log('[tRPC empreendimentos.create] Iniciando criação:', input.name);
            try {
                await connectToDatabase();
                if (!ctx.tenantId || !ctx.user) {
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Contexto inválido.' });
                }

                const tenantId = ctx.tenantId;
                const tenantObjectId = new Types.ObjectId(tenantId);
                const userId = new Types.ObjectId(ctx.user.id);

                const parsedStartDate = safeParseDate(input.startDate);
                const parsedEndDate = safeParseDate(input.endDate);
                if (!parsedStartDate || !parsedEndDate || !isDateValid(parsedStartDate) || !isDateValid(parsedEndDate) || parsedStartDate > parsedEndDate) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas inválidas ou início posterior ao fim.' });
                }

                const newEmpreendimento = new Empreendimento({
                    ...input,
                    tenantId: tenantObjectId,
                    startDate: parsedStartDate,
                    endDate: parsedEndDate,
                    image: input.image ?? undefined,
                    createdBy: userId,
                });
                await newEmpreendimento.save();

                const newEmpreendimentoIdString = newEmpreendimento._id.toString();
                let folderId: string | undefined = undefined; // Alterado de null para undefined
                let sheetId: string | undefined = undefined;   // Alterado de null para undefined
                let sheetUrl: string | undefined = undefined;

                // Integração com Google Drive
                try {
                    const folderResult = await createEmpreendimentoFolders(tenantId, newEmpreendimentoIdString, newEmpreendimento.name);
                    if (folderResult.success && folderResult.empreendimentoFolderId) {
                        folderId = folderResult.empreendimentoFolderId;
                        newEmpreendimento.folderId = folderId;
                    } else {
                        console.warn(`[tRPC create Empr] Falha ao criar pasta Drive: ${folderResult.error}`);
                    }
                } catch (driveError: any) {
                    console.error(`[tRPC create Empr] Erro ao criar pasta Drive para Tenant ${tenantId}:`, driveError);
                }

                // Integração com Google Sheets
                try {
                    const sheetResult = await createEmpreendimentoSheet(tenantId, newEmpreendimentoIdString, newEmpreendimento.name);
                    if (sheetResult && sheetResult.success && sheetResult.spreadsheetId) {
                        sheetId = sheetResult.spreadsheetId;
                        sheetUrl = sheetResult.url;
                        newEmpreendimento.sheetId = sheetId;
                    } else {
                        console.warn(`[tRPC create Empr] Falha ao criar planilha Sheets: ${sheetResult?.error || 'Retorno inesperado'}`);
                    }
                } catch (sheetError: any) {
                    console.error(`[tRPC create Empr] Erro ao criar planilha Sheets para Tenant ${tenantId}:`, sheetError);
                }

                // Salvar novamente se houver IDs de integração
                if (folderId || sheetId) {
                    await newEmpreendimento.save();
                }

                console.log(`[tRPC create Empr] Empreendimento criado: ${newEmpreendimento.name}, Folder: ${folderId}, Sheet: ${sheetId}`);
                return {
                    success: true,
                    message: 'Empreendimento criado' + (!folderId || !sheetId ? ' (verifique configuração Google)' : ''),
                    empreendimento: {
                        id: newEmpreendimentoIdString,
                        name: newEmpreendimento.name,
                        folderId,
                        sheetId,
                        sheetUrl,
                    },
                };
            } catch (error) {
                console.error('[tRPC create Empr] Erro:', error);
                if (error instanceof z.ZodError) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos.', cause: error });
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao criar empreendimento',
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    update: tenantAdminProcedure
        .input(z.object({ id: z.string().refine((id) => mongoose.isValidObjectId(id)), data: updateEmpreendimentoSchema }))
        .mutation(async ({ input, ctx }: { input: { id: string; data: UpdateEmpreendimentoInput }; ctx: Context }) => {
            console.log(`[tRPC empreendimentos.update] Atualizando ID: ${input.id}`);
            try {
                await connectToDatabase();
                const tenantId = new Types.ObjectId(ctx.tenantId!);
                const existingEmp = await Empreendimento.findOne({ _id: new Types.ObjectId(input.id), tenantId });

                if (!existingEmp) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado ou pertence a outro tenant' });
                }

                const updatePayload: { [key: string]: any } = { updatedAt: new Date() };
                for (const [key, value] of Object.entries(input.data)) {
                    if (value !== undefined) {
                        if (key === 'startDate' || key === 'endDate') {
                            const parsedDate = safeParseDate(value as string | Date);
                            if (parsedDate) {
                                updatePayload[key] = parsedDate;
                            } else if (value === null) {
                                updatePayload[key] = null;
                            }
                        } else {
                            updatePayload[key] = value;
                        }
                    }
                }

                const finalStartDate = updatePayload.startDate ?? existingEmp.startDate;
                const finalEndDate = updatePayload.endDate ?? existingEmp.endDate;
                if (finalStartDate && finalEndDate && isDateValid(finalStartDate) && isDateValid(finalEndDate) && finalStartDate > finalEndDate) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data de início posterior à data de conclusão.' });
                }

                const updatedEmpreendimento = await Empreendimento.findByIdAndUpdate(input.id, { $set: updatePayload }, { new: true, runValidators: true }).lean<any>();
                if (!updatedEmpreendimento) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado após atualização' });
                }

                const validImageUrl = isValidHttpUrl(updatedEmpreendimento.image) ? updatedEmpreendimento.image : null;
                console.log(`[tRPC update Empr] Empreendimento atualizado: ${updatedEmpreendimento.name}`);
                return {
                    success: true,
                    message: 'Empreendimento atualizado',
                    empreendimento: { id: updatedEmpreendimento._id.toString(), name: updatedEmpreendimento.name, image: validImageUrl },
                };
            } catch (error) {
                console.error('[tRPC update Empr] Erro:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao atualizar empreendimento',
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    delete: tenantAdminProcedure
        .input(deleteEmpreendimentoSchema)
        .mutation(async ({ input, ctx }: { input: DeleteEmpreendimentoInput; ctx: Context }) => {
            console.log(`[tRPC empreendimentos.delete] Excluindo ID: ${input.id}`);
            try {
                await connectToDatabase();
                const tenantId = new Types.ObjectId(ctx.tenantId!);
                const [despesasCount, documentosCount] = await Promise.all([
                    Despesa.countDocuments({ empreendimento: new Types.ObjectId(input.id), tenantId }),
                    Documento.countDocuments({ empreendimento: new Types.ObjectId(input.id), tenantId }),
                ]);

                if (despesasCount > 0) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `Existem ${despesasCount} despesa(s) associada(s).` });
                }
                if (documentosCount > 0) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `Existem ${documentosCount} documento(s) associado(s).` });
                }

                const deleted = await Empreendimento.findOneAndDelete({ _id: new Types.ObjectId(input.id), tenantId });
                if (!deleted) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado ou pertence a outro tenant' });
                }

                console.log(`[tRPC delete Empr] Empreendimento excluído: ${deleted.name}`);
                return { success: true, message: 'Empreendimento excluído' };
            } catch (error) {
                console.error('[tRPC delete Empr] Erro:', error);
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao excluir empreendimento',
                    cause: error instanceof Error ? error.message : String(error),
                });
            }
        }),
});

export type EmpreendimentosRouter = typeof empreendimentosRouter;
// ============================================================
// FIM DO ARQUIVO CORRIGIDO: server/api/routers/empreendimentos.ts
// ============================================================