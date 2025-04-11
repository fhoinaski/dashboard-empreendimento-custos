// FILE: server/api/routers/despesas.ts (Merged and Refactored)
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento, User, DespesaDocument } from '@/lib/db/models';
import mongoose, { Types, FilterQuery } from 'mongoose';
import { GoogleSheetsService } from '@/server/services/integration/googleSheets.service';
import { logIntegration } from '@/server/services/logging/integrationLogger';
import { format, startOfDay, endOfDay, addDays, parseISO, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    createDespesaSchema,
    updateDespesaSchema,
    reviewDespesaSchema,
    despesaResponseSchema,
    despesaFilterSchema,
    despesaListResponseSchema,
    despesaSummarySchema,
    pendingApprovalsResponseSchema,
    upcomingExpensesResponseSchema,
    despesaComparisonResponseSchema,
    monthlySummaryResponseSchema,
    despesaCategorySchema,
    DespesaStatus,
    DespesaApprovalStatus,
    DespesaCategory,
    updateDespesaResponseSchema,
    getMonthlySummaryInputSchema,
    getComparisonByCategoryInputSchema,
    listPendingReviewInputSchema,
    getGeneralSummaryInputSchema,
    listUpcomingDueInputSchema,
    pendingApprovalItemSchema,
    upcomingExpenseItemSchema,
    despesaComparisonItemSchema,
    monthlySummaryItemSchema,
    CreateDespesaInput,
    UpdateDespesaInput,
    ReviewDespesaInput,
} from '../schemas/despesas';
import type { Context } from '../context';

// Interfaces
interface Attachment {
    _id?: Types.ObjectId | string;
    fileId?: string | null;
    name?: string | null;
    url?: string | null;
}
interface DespesaUpdatePayload {
    tenantId?: Types.ObjectId;
    description?: string | null;
    value?: number | null;
    date?: Date | null;
    dueDate?: Date | null;
    status?: DespesaStatus | null;
    category?: DespesaCategory | null;
    paymentMethod?: string | null;
    notes?: string | null;
    attachments?: Attachment[] | null;
    approvalStatus?: DespesaApprovalStatus | null;
    reviewedBy?: Types.ObjectId | null;
    reviewedAt?: Date | null;
    updatedAt?: Date;
    empreendimento?: Types.ObjectId | null;
}

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

const buildDespesaFilter = (inputFilters: z.infer<typeof despesaFilterSchema>, ctxUser: Context['user']): FilterQuery<DespesaDocument> => {
    if (!ctxUser?.tenantId) {
        console.error("[buildDespesaFilter] Erro: Usuário ou Tenant ID ausente.");
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    const tenantObjectId = new Types.ObjectId(ctxUser.tenantId);
    const filter: FilterQuery<DespesaDocument> = { tenantId: tenantObjectId };
    const { empreendimento, status, category, approvalStatus, search, startDate, endDate } = inputFilters;

    if (ctxUser.role === 'user') {
        const assignedIds = (ctxUser.assignedEmpreendimentos || []).filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id));
        if (assignedIds.length === 0) {
            filter._id = new Types.ObjectId();
            return filter;
        }
        if (empreendimento && empreendimento !== 'todos' && mongoose.isValidObjectId(empreendimento)) {
            const requestedEmpId = new Types.ObjectId(empreendimento);
            if (assignedIds.some(id => id.equals(requestedEmpId))) {
                filter.empreendimento = requestedEmpId;
            } else {
                filter._id = new Types.ObjectId();
                return filter;
            }
        } else {
            filter.empreendimento = { $in: assignedIds };
        }
    } else if (empreendimento && empreendimento !== 'todos' && mongoose.isValidObjectId(empreendimento)) {
        filter.empreendimento = new Types.ObjectId(empreendimento);
    }

    if (status?.length) filter.status = { $in: status };
    if (category) filter.category = category;
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (search) {
        const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = [{ description: { $regex: esc, $options: 'i' } }, { notes: { $regex: esc, $options: 'i' } }];
    }
    if (startDate || endDate) {
        filter.dueDate = {};
        const psd = safeParseDate(startDate);
        const ped = safeParseDate(endDate);
        if (psd && isDateValid(psd)) filter.dueDate.$gte = startOfDay(psd);
        if (ped && isDateValid(ped)) filter.dueDate.$lte = endOfDay(ped);
        if (!filter.dueDate.$gte && !filter.dueDate.$lte) {
            delete filter.dueDate;
        } else if (filter.dueDate?.$gte && filter.dueDate?.$lte && filter.dueDate.$gte > filter.dueDate.$lte) {
            filter._id = new Types.ObjectId();
        }
    }
    return filter;
};

const SHEET_COLUMN_ORDER: (keyof DespesaDocument | '_id')[] = [
    '_id', 'description', 'value', 'date', 'dueDate', 'status', 'category', 'paymentMethod', 'notes', 'approvalStatus', 'createdAt', 'updatedAt'
];

function formatValueForSheet(value: any): string | number | boolean | null {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return format(value, 'dd/MM/yyyy', { locale: ptBR });
    if (value instanceof Types.ObjectId) return value.toString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

function despesaToSheetArray(despesaData: Partial<DespesaDocument & { _id: string | Types.ObjectId }>): any[] {
    return SHEET_COLUMN_ORDER.map(key => formatValueForSheet((despesaData as any)[key]));
}

export const despesasRouter = router({
    getAll: protectedProcedure
        .input(despesaFilterSchema)
        .output(despesaListResponseSchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
            try {
                await connectToDatabase();
                const { page, limit, sortBy = 'dueDate', sortOrder = 'desc' } = input;
                const skip = (page - 1) * limit;
                const filter = buildDespesaFilter(input, ctx.user);
                if (filter._id instanceof Types.ObjectId) return { despesas: [], pagination: { total: 0, limit, page, pages: 0, hasMore: false } };
                const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1, '_id': -1 };
                const [despesas, total] = await Promise.all([
                    Despesa.find(filter).sort(sortCriteria).skip(skip).limit(limit)
                        .populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', '_id name')
                        .populate<{ createdBy: { _id: Types.ObjectId; name?: string } | null }>('createdBy', '_id name')
                        .populate<{ reviewedBy: { _id: Types.ObjectId; name?: string } | null }>('reviewedBy', '_id name')
                        .lean(),
                    Despesa.countDocuments(filter)
                ]);
                const formattedDespesas = despesas.map(despesa => despesaResponseSchema.parse({
                    _id: despesa._id?.toString() ?? '',
                    description: despesa.description ?? 'N/A',
                    value: typeof despesa.value === 'number' ? despesa.value : 0,
                    date: despesa.date instanceof Date ? despesa.date.toISOString() : 'N/A',
                    dueDate: despesa.dueDate instanceof Date ? despesa.dueDate.toISOString() : 'N/A',
                    status: despesa.status ?? 'Pendente',
                    approvalStatus: despesa.approvalStatus ?? 'Pendente',
                    category: despesa.category ?? 'Outros',
                    paymentMethod: despesa.paymentMethod ?? null,
                    notes: despesa.notes ?? null,
                    empreendimento: despesa.empreendimento ? { _id: despesa.empreendimento._id?.toString() ?? '', name: despesa.empreendimento.name ?? 'N/A' } : undefined,
                    createdBy: despesa.createdBy ? { _id: despesa.createdBy._id?.toString() ?? '', name: despesa.createdBy.name ?? 'N/A' } : undefined,
                    reviewedBy: despesa.reviewedBy ? { _id: despesa.reviewedBy._id?.toString() ?? '', name: despesa.reviewedBy.name ?? 'N/A' } : undefined,
                    reviewedAt: despesa.reviewedAt instanceof Date ? despesa.reviewedAt.toISOString() : null,
                    attachments: despesa.attachments?.map((att: any) => ({ _id: att?._id?.toString(), fileId: att?.fileId, name: att?.name, url: att?.url })).filter(Boolean) ?? [],
                    createdAt: despesa.createdAt instanceof Date ? despesa.createdAt.toISOString() : 'N/A',
                    updatedAt: despesa.updatedAt instanceof Date ? despesa.updatedAt.toISOString() : (despesa.createdAt instanceof Date ? despesa.createdAt.toISOString() : 'N/A'),
                }));
                return { despesas: formattedDespesas, pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total } };
            } catch (error) {
                console.error('Erro listar despesas:', error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar despesas' });
            }
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
        .output(despesaResponseSchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user?.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });
            const tenantId = new Types.ObjectId(ctx.user.tenantId);
            try {
                await connectToDatabase();
                const despesa = await Despesa.findOne({ _id: new Types.ObjectId(input.id), tenantId })
                    .populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', '_id name')
                    .populate<{ createdBy: { _id: Types.ObjectId; name?: string } | null }>('createdBy', '_id name')
                    .populate<{ reviewedBy: { _id: Types.ObjectId; name?: string } | null }>('reviewedBy', '_id name')
                    .lean();
                if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada neste tenant' });
                const isCreator = despesa.createdBy?._id.equals(ctx.user.id);
                const assignedEmps = ctx.user.assignedEmpreendimentos || [];
                const isAssigned = assignedEmps.includes(despesa.empreendimento?._id.toString() ?? '');
                const canView = ctx.user.role === 'admin' || ctx.user.role === 'manager' || (ctx.user.role === 'user' && (isCreator || isAssigned));
                if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
                return despesaResponseSchema.parse({
                    _id: despesa._id?.toString() ?? '',
                    description: despesa.description ?? 'N/A',
                    value: typeof despesa.value === 'number' ? despesa.value : 0,
                    date: despesa.date instanceof Date ? despesa.date.toISOString() : 'N/A',
                    dueDate: despesa.dueDate instanceof Date ? despesa.dueDate.toISOString() : 'N/A',
                    status: despesa.status ?? 'Pendente',
                    approvalStatus: despesa.approvalStatus ?? 'Pendente',
                    category: despesa.category ?? 'Outros',
                    paymentMethod: despesa.paymentMethod ?? null,
                    notes: despesa.notes ?? null,
                    empreendimento: despesa.empreendimento ? { _id: despesa.empreendimento._id?.toString() ?? '', name: despesa.empreendimento.name ?? 'N/A' } : undefined,
                    createdBy: despesa.createdBy ? { _id: despesa.createdBy._id?.toString() ?? '', name: despesa.createdBy.name ?? 'N/A' } : undefined,
                    reviewedBy: despesa.reviewedBy ? { _id: despesa.reviewedBy._id?.toString() ?? '', name: despesa.reviewedBy.name ?? 'N/A' } : undefined,
                    reviewedAt: despesa.reviewedAt instanceof Date ? despesa.reviewedAt.toISOString() : null,
                    attachments: despesa.attachments?.map((att: any) => ({ _id: att?._id?.toString(), fileId: att?.fileId, name: att?.name, url: att?.url })).filter(Boolean) ?? [],
                    createdAt: despesa.createdAt instanceof Date ? despesa.createdAt.toISOString() : 'N/A',
                    updatedAt: despesa.updatedAt instanceof Date ? despesa.updatedAt.toISOString() : (despesa.createdAt instanceof Date ? despesa.createdAt.toISOString() : 'N/A'),
                });
            } catch (error) {
                console.error(`Erro buscar despesa ${input.id}:`, error);
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar despesa' });
            }
        }),

    create: protectedProcedure
        .input(createDespesaSchema)
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user?.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });
            const tenantId = ctx.user.tenantId;
            const tenantObjectId = new Types.ObjectId(tenantId);
            const userId = new Types.ObjectId(ctx.user.id);
            const userRole = ctx.user.role;
            const userAssignedEmpreendimentos = (ctx.user.assignedEmpreendimentos || []);
            let logStatus: 'SUCCESS' | 'ERROR' | 'WARNING' = 'ERROR';
            let logDetails: any = { input };

            try {
                await connectToDatabase();
                const empreendimento = await Empreendimento.findOne({ _id: new Types.ObjectId(input.empreendimento), tenantId: tenantObjectId }).select('_id name sheetId').lean();
                if (!empreendimento) throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado neste tenant' });
                if (userRole === 'user' && !userAssignedEmpreendimentos.includes(empreendimento._id.toString())) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para este empreendimento' });

                const approvalStatus: DespesaApprovalStatus = userRole === 'admin' ? 'Aprovado' : 'Pendente';
                const reviewedBy = approvalStatus === 'Aprovado' ? userId : undefined;
                const reviewedAt = approvalStatus === 'Aprovado' ? new Date() : undefined;
                let finalStatus: DespesaStatus = input.status;
                if (approvalStatus === 'Aprovado' && input.status !== 'Pago') finalStatus = 'A vencer';

                const parsedDate = safeParseDate(input.date);
                const parsedDueDate = safeParseDate(input.dueDate);
                if (!parsedDate || !parsedDueDate || !isDateValid(parsedDate) || !isDateValid(parsedDueDate) || parsedDate > parsedDueDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas inválidas.' });

                const despesaDataToCreate: Partial<DespesaDocument> = {
                    tenantId: tenantObjectId,
                    description: input.description,
                    value: input.value,
                    date: parsedDate,
                    dueDate: parsedDueDate,
                    status: finalStatus,
                    empreendimento: empreendimento._id,
                    category: input.category,
                    createdBy: userId,
                    approvalStatus,
                    reviewedBy,
                    reviewedAt,
                    paymentMethod: input.paymentMethod || undefined,
                    notes: input.notes || undefined,
                    attachments: [],
                };
                const newDespesa = await Despesa.create(despesaDataToCreate);
                if (!newDespesa?._id) throw new Error("Falha ao criar despesa.");
                const newDespesaIdString = newDespesa._id.toString();

                console.log(`[tRPC despesas.create] Despesa ${newDespesaIdString} criada Tenant ${tenantId}`);
                logDetails.despesaId = newDespesaIdString;
                logStatus = 'SUCCESS';

                const empSheetId = empreendimento.sheetId;
                if (empSheetId && approvalStatus === 'Aprovado') {
                    console.log(`[tRPC create] Tentando adicionar à planilha ${empSheetId}...`);
                    const sheetsService = new GoogleSheetsService();
                    const sheetData = {
                        _id: newDespesaIdString,
                        description: newDespesa.description,
                        value: newDespesa.value,
                        date: newDespesa.date,
                        dueDate: newDespesa.dueDate,
                        status: newDespesa.status,
                        category: newDespesa.category,
                        paymentMethod: newDespesa.paymentMethod,
                        notes: newDespesa.notes,
                        approvalStatus: newDespesa.approvalStatus,
                        createdAt: newDespesa.createdAt,
                        updatedAt: newDespesa.updatedAt,
                    };
                    const sheetDataArray = despesaToSheetArray(sheetData);
                    const sheetResult = await sheetsService.addRow(tenantId, empSheetId, sheetDataArray);
                    if (!sheetResult.success) {
                        console.warn(`[tRPC create] Falha ao adicionar na planilha: ${sheetResult.error}`);
                        logStatus = 'WARNING';
                        logDetails.sheetsError = sheetResult.error;
                    } else {
                        console.log(`[tRPC create] Adicionado à planilha com sucesso. Range: ${sheetResult.details?.updatedRange}`);
                    }
                } else if (!empSheetId && approvalStatus === 'Aprovado') {
                    console.warn(`[tRPC create] Planilha não configurada para Empreendimento ${empreendimento._id}. Despesa ${newDespesaIdString} não adicionada ao Sheets.`);
                    logDetails.sheetsWarning = "SheetId not configured";
                }

                await logIntegration(tenantId, 'Database', 'CREATE_EXPENSE', logStatus, logDetails);

                return {
                    success: true,
                    message: logStatus === 'WARNING' ? 'Despesa criada, falha na sincronização Sheets.' : (approvalStatus === 'Aprovado' ? 'Despesa criada e aprovada' : 'Despesa criada, aguardando aprovação'),
                    despesa: { id: newDespesaIdString }
                };
            } catch (error) {
                logDetails.error = error instanceof Error ? error.message : String(error);
                await logIntegration(tenantId, 'Database', 'CREATE_EXPENSE', 'ERROR', logDetails)
                    .catch(logErr => console.error("Failed to log DB error:", logErr));
                console.error('Erro criar despesa:', error);
                if (error instanceof TRPCError) throw error;
                if (error instanceof mongoose.Error.ValidationError) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar despesa' });
            }
        }),

    update: protectedProcedure
        .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)), data: updateDespesaSchema }))
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user?.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });
            const tenantId = ctx.user.tenantId;
            const userId = new Types.ObjectId(ctx.user.id);
            const userRole = ctx.user.role;
            let logStatus: 'SUCCESS' | 'ERROR' | 'WARNING' = 'ERROR';
            let logDetails: any = { despesaId: input.id, inputData: input.data };

            try {
                await connectToDatabase();
                const despesa = await Despesa.findOne({ _id: new Types.ObjectId(input.id), tenantId: new Types.ObjectId(tenantId) });
                if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada neste tenant' });
                const isCreator = despesa.createdBy.equals(userId);
                const canEdit = userRole === 'admin' || (isCreator && despesa.approvalStatus === 'Pendente');
                if (!canEdit) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para editar' });

                const updatePayload: Partial<DespesaUpdatePayload> = { updatedAt: new Date() };
                const dataToUpdate = input.data;
                if (dataToUpdate.description !== undefined) updatePayload.description = dataToUpdate.description;
                if (dataToUpdate.value !== undefined) updatePayload.value = dataToUpdate.value;
                if (dataToUpdate.date !== undefined) { const pd = safeParseDate(dataToUpdate.date); if (pd && isDateValid(pd)) updatePayload.date = pd; }
                if (dataToUpdate.dueDate !== undefined) { const pdd = safeParseDate(dataToUpdate.dueDate); if (pdd && isDateValid(pdd)) updatePayload.dueDate = pdd; }
                if (dataToUpdate.status !== undefined) updatePayload.status = dataToUpdate.status;
                if (dataToUpdate.category !== undefined) updatePayload.category = dataToUpdate.category;
                if (dataToUpdate.paymentMethod !== undefined) updatePayload.paymentMethod = dataToUpdate.paymentMethod;
                if (dataToUpdate.notes !== undefined) updatePayload.notes = dataToUpdate.notes;
                if (dataToUpdate.attachments !== undefined) updatePayload.attachments = dataToUpdate.attachments;

                const finalDate = updatePayload.date ?? despesa.date;
                const finalDueDate = updatePayload.dueDate ?? despesa.dueDate;
                if (finalDate && finalDueDate && isDateValid(finalDate) && isDateValid(finalDueDate) && finalDate > finalDueDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data não pode ser posterior ao vencimento.' });

                const updatedDespesaDoc = await Despesa.findByIdAndUpdate(input.id, { $set: updatePayload }, { new: true, runValidators: true })
                    .populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string; name?: string } | null }>('empreendimento', '_id sheetId name')
                    .lean();
                if (!updatedDespesaDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Falha ao atualizar' });

                logStatus = 'SUCCESS';
                console.log(`[tRPC despesas.update] Despesa ${input.id} atualizada Tenant ${tenantId}`);

                const empSheetId = updatedDespesaDoc.empreendimento?.sheetId;
                if (empSheetId && updatedDespesaDoc.approvalStatus === 'Aprovado') {
                    console.log(`[tRPC update] Tentando atualizar planilha ${empSheetId}...`);
                    const sheetsService = new GoogleSheetsService();
                    const sheetData = {
                        _id: updatedDespesaDoc._id.toString(),
                        description: updatedDespesaDoc.description,
                        value: updatedDespesaDoc.value,
                        date: updatedDespesaDoc.date,
                        dueDate: updatedDespesaDoc.dueDate,
                        status: updatedDespesaDoc.status,
                        category: updatedDespesaDoc.category,
                        paymentMethod: updatedDespesaDoc.paymentMethod,
                        notes: updatedDespesaDoc.notes,
                        approvalStatus: updatedDespesaDoc.approvalStatus,
                        createdAt: updatedDespesaDoc.createdAt,
                        updatedAt: updatedDespesaDoc.updatedAt,
                    };
                    const sheetDataArray = despesaToSheetArray(sheetData);
                    const sheetResult = await sheetsService.updateRow(tenantId, empSheetId, input.id, sheetDataArray);
                    if (!sheetResult.success) {
                        console.warn(`[tRPC update] Falha ao atualizar na planilha: ${sheetResult.error}`);
                        logStatus = 'WARNING';
                        logDetails.sheetsError = sheetResult.error;
                    } else {
                        console.log(`[tRPC update] Atualizado na planilha com sucesso. Linha: ${sheetResult.details?.updatedRow ?? 'N/A'}`);
                    }
                } else if (!empSheetId && updatedDespesaDoc.approvalStatus === 'Aprovado') {
                    console.warn(`[tRPC update] Planilha não configurada para Empreendimento ${updatedDespesaDoc.empreendimento?._id}. Despesa ${input.id} não atualizada no Sheets.`);
                    logDetails.sheetsWarning = "SheetId not configured";
                }

                await logIntegration(tenantId, 'Database', 'UPDATE_EXPENSE', logStatus, logDetails);

                return {
                    success: true,
                    message: logStatus === 'WARNING' ? 'Despesa atualizada, falha na sincronização Sheets.' : 'Despesa atualizada e sincronizada.',
                    despesa: updateDespesaResponseSchema.parse({ id: updatedDespesaDoc._id.toString(), description: updatedDespesaDoc.description ?? 'N/A' })
                };
            } catch (error) {
                logDetails.error = error instanceof Error ? error.message : String(error);
                await logIntegration(tenantId, 'Database', 'UPDATE_EXPENSE', 'ERROR', logDetails)
                    .catch(logErr => console.error("Failed to log DB error:", logErr));
                console.error('Erro update despesa:', error);
                if (error instanceof z.ZodError) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar' });
            }
        }),

    review: tenantAdminProcedure
        .input(reviewDespesaSchema.extend({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
        .mutation(async ({ input, ctx }) => {
            if (!ctx.tenantId) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Tenant ID ausente.' });
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
            const tenantId = ctx.tenantId;
            let logStatus: 'SUCCESS' | 'ERROR' | 'WARNING' = 'ERROR';
            let logDetails: any = { despesaId: input.id, approvalStatus: input.approvalStatus };

            try {
                await connectToDatabase();
                const despesa = await Despesa.findOne({ _id: new Types.ObjectId(input.id), tenantId: new Types.ObjectId(tenantId) });
                if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada neste tenant' });
                if (despesa.approvalStatus !== 'Pendente') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Despesa já revisada' });

                const update: Partial<DespesaUpdatePayload> = {
                    approvalStatus: input.approvalStatus,
                    reviewedBy: new Types.ObjectId(ctx.user.id),
                    reviewedAt: new Date(),
                    updatedAt: new Date(),
                };
                if (input.notes) update.notes = `${despesa.notes ? despesa.notes + '\n' : ''}Revisão (${input.approvalStatus}): ${input.notes}`;
                if (input.approvalStatus === 'Aprovado' && despesa.status !== 'Pago') update.status = 'A vencer';

                const updatedDespesa = await Despesa.findByIdAndUpdate(input.id, { $set: update }, { new: true, runValidators: true })
                    .populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string; name?: string } | null }>('empreendimento', '_id sheetId name')
                    .lean();
                if (!updatedDespesa) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar revisão' });

                logStatus = 'SUCCESS';
                console.log(`[tRPC review] Despesa ${input.id} revisada como ${input.approvalStatus}`);

                const empSheetId = updatedDespesa.empreendimento?.sheetId;
                if (empSheetId) {
                    const sheetsService = new GoogleSheetsService();
                    const sheetData = {
                        _id: updatedDespesa._id.toString(),
                        description: updatedDespesa.description,
                        value: updatedDespesa.value,
                        date: updatedDespesa.date,
                        dueDate: updatedDespesa.dueDate,
                        status: updatedDespesa.status,
                        category: updatedDespesa.category,
                        paymentMethod: updatedDespesa.paymentMethod,
                        notes: updatedDespesa.notes,
                        approvalStatus: updatedDespesa.approvalStatus,
                        createdAt: updatedDespesa.createdAt,
                        updatedAt: updatedDespesa.updatedAt,
                    };
                    const sheetDataArray = despesaToSheetArray(sheetData);
                    let sheetResult: { success: boolean; error?: string; details?: any };

                    if (input.approvalStatus === 'Aprovado') {
                        console.log(`[tRPC review approve] Tentando atualizar planilha ${empSheetId}...`);
                        sheetResult = await sheetsService.updateRow(tenantId, empSheetId, input.id, sheetDataArray);
                    } else {
                        console.log(`[tRPC review reject] Tentando excluir da planilha ${empSheetId}...`);
                        sheetResult = await sheetsService.deleteFileOrResource!(tenantId, input.id, { spreadsheetId: empSheetId });
                    }

                    if (!sheetResult.success) {
                        console.warn(`[tRPC review] Falha na operação Sheets (${input.approvalStatus}): ${sheetResult.error}`);
                        logStatus = 'WARNING';
                        logDetails.sheetsError = sheetResult.error;
                    } else {
                        console.log(`[tRPC review] Operação Sheets (${input.approvalStatus}) bem-sucedida.`);
                    }
                } else if (input.approvalStatus === 'Aprovado') {
                    console.warn(`[tRPC review] Planilha não configurada para Empreendimento ${updatedDespesa.empreendimento?._id}. Despesa ${input.id} não sincronizada.`);
                    logDetails.sheetsWarning = "SheetId not configured";
                }

                await logIntegration(tenantId, 'Database', 'REVIEW_EXPENSE', logStatus, logDetails);

                return {
                    success: true,
                    message: logStatus === 'WARNING' ? `Despesa ${input.approvalStatus.toLowerCase()}, falha na sincronização Sheets.` : `Despesa ${input.approvalStatus.toLowerCase()} e sincronizada.`
                };
            } catch (error) {
                logDetails.error = error instanceof Error ? error.message : String(error);
                await logIntegration(tenantId, 'Database', 'REVIEW_EXPENSE', 'ERROR', logDetails)
                    .catch(logErr => console.error("Failed to log DB error:", logErr));
                console.error('Erro review despesa:', error);
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao revisar' });
            }
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
        .mutation(async ({ input, ctx }) => {
            if (!ctx.user?.tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });
            const tenantId = ctx.user.tenantId;
            let logStatus: 'SUCCESS' | 'ERROR' | 'WARNING' = 'ERROR';
            let logDetails: any = { despesaId: input.id };

            try {
                await connectToDatabase();
                const despesa = await Despesa.findOne({ _id: new Types.ObjectId(input.id), tenantId: new Types.ObjectId(tenantId) })
                    .populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string } | null }>('empreendimento', '_id sheetId');
                if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada neste tenant' });

                const isCreator = despesa.createdBy.equals(ctx.user.id);
                const canDelete = ctx.user.role === 'admin' || (isCreator && despesa.approvalStatus === 'Pendente');
                if (!canDelete) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para excluir' });
                console.log(`[tRPC delete] Permissão OK (${ctx.user.role}). Excluindo...`);

                const empSheetId = despesa.empreendimento?.sheetId;
                await Despesa.findByIdAndDelete(input.id);
                logStatus = 'SUCCESS';
                console.log(`[tRPC delete] Despesa ${input.id} excluída do DB.`);

                if (empSheetId) {
                    console.log(`[tRPC delete] Tentando excluir da planilha ${empSheetId}...`);
                    const sheetsService = new GoogleSheetsService();
                    const sheetResult = await sheetsService.deleteFileOrResource!(tenantId, input.id, { spreadsheetId: empSheetId });
                    if (!sheetResult.success) {
                        console.warn(`[tRPC delete] Falha ao excluir da planilha: ${sheetResult.error}`);
                        logStatus = 'WARNING';
                        logDetails.sheetsError = sheetResult.error;
                    } else {
                        console.log(`[tRPC delete] Excluído da planilha com sucesso.`);
                    }
                }

                await logIntegration(tenantId, 'Database', 'DELETE_EXPENSE', logStatus, logDetails);

                return {
                    success: true,
                    message: logStatus === 'WARNING' ? 'Despesa excluída, falha na sincronização Sheets.' : 'Despesa excluída e sincronizada.'
                };
            } catch (error) {
                logDetails.error = error instanceof Error ? error.message : String(error);
                await logIntegration(tenantId, 'Database', 'DELETE_EXPENSE', 'ERROR', logDetails)
                    .catch(logErr => console.error("Failed to log DB error:", logErr));
                console.error('Erro delete despesa:', error);
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir' });
            }
        }),

    getCategories: publicProcedure
        .output(z.array(despesaCategorySchema))
        .query(() => despesaCategorySchema.options),

    getComparisonByCategory: tenantAdminProcedure
        .input(getComparisonByCategoryInputSchema)
        .output(despesaComparisonResponseSchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
            await connectToDatabase();
            const filter = buildDespesaFilter({ ...input, page: 1, limit: 9999 }, ctx.user);
            const stats = await Despesa.aggregate([
                { $match: filter },
                { $group: { _id: '$category', totalValue: { $sum: '$value' }, count: { $sum: 1 } } },
                { $project: { _id: 0, category: '$_id', totalValue: 1, count: 1 } },
                { $sort: { category: 1 } }
            ]);
            return z.array(despesaComparisonItemSchema).parse(stats);
        }),

    getMonthlySummary: tenantAdminProcedure
        .input(getMonthlySummaryInputSchema)
        .output(monthlySummaryResponseSchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
            await connectToDatabase();
            const filter = buildDespesaFilter({ ...input, page: 1, limit: 9999 }, ctx.user);
            const monthlyStats = await Despesa.aggregate([
                { $match: filter },
                { $group: { _id: { month: { $month: "$date" }, year: { $year: "$date" } }, totalValue: { $sum: '$value' } } },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
                {
                    $project: {
                        _id: 0,
                        nome: { $concat: [{ $arrayElemAt: [["Inv", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], "$_id.month"] }, "/", { $substr: [{ $toString: "$_id.year" }, 2, 2] }] },
                        valor: "$totalValue",
                    }
                }
            ]);
            return z.array(monthlySummaryItemSchema).parse(monthlyStats);
        }),

    listPendingReview: tenantAdminProcedure
        .input(listPendingReviewInputSchema)
        .output(pendingApprovalsResponseSchema)
        .query(async ({ input, ctx }) => {
            await connectToDatabase();
            const { limit, page } = input;
            const skip = (page - 1) * limit;
            const tenantId = new Types.ObjectId(ctx.tenantId!);
            const filter = { tenantId, approvalStatus: 'Pendente' };
            const [pending, total] = await Promise.all([
                Despesa.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
                    .populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', 'name _id')
                    .lean<any[]>(),
                Despesa.countDocuments(filter)
            ]);
            const items = pending.map(d => ({
                id: d._id.toString(),
                description: d.description,
                empreendimentoName: d.empreendimento?.name ?? 'N/A',
                value: d.value,
                createdAt: d.createdAt.toISOString(),
            }));
            return { items, pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total } };
        }),

    getGeneralSummary: protectedProcedure
        .input(getGeneralSummaryInputSchema)
        .output(despesaSummarySchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
            await connectToDatabase();
            const filterInputForHelper: z.infer<typeof despesaFilterSchema> = { page: 1, limit: 9999, ...input };
            const filter = buildDespesaFilter(filterInputForHelper, ctx.user);
            const summary = await Despesa.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalValue: { $sum: '$value' },
                        totalCount: { $sum: 1 },
                        paidValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } },
                        dueValue: { $sum: { $cond: [{ $eq: ['$status', 'A vencer'] }, '$value', 0] } },
                    }
                }
            ]);
            const data = summary[0] || { totalValue: 0, totalCount: 0, paidValue: 0, dueValue: 0 };
            return despesaSummarySchema.parse({
                totalValue: data.totalValue,
                totalCount: data.totalCount,
                paidValue: data.paidValue,
                dueValue: data.dueValue,
            });
        }),

    listUpcomingDue: protectedProcedure
        .input(listUpcomingDueInputSchema)
        .output(upcomingExpensesResponseSchema)
        .query(async ({ input, ctx }) => {
            if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
            await connectToDatabase();
            const today = startOfDay(new Date());
            const next7Days = endOfDay(addDays(today, 7));
            const filterInputForHelper: z.infer<typeof despesaFilterSchema> = { page: 1, limit: input.limit, empreendimento: input.empreendimentoId };
            const filter = buildDespesaFilter(filterInputForHelper, ctx.user);
            filter.status = 'A vencer';
            filter.approvalStatus = 'Aprovado';
            filter.dueDate = { $gte: today, $lte: next7Days };
            const upcoming = await Despesa.find(filter).sort({ dueDate: 1 }).limit(input.limit).lean<any[]>();
            const items = upcoming.map(d => ({
                id: d._id.toString(),
                description: d.description,
                dueDate: d.dueDate.toISOString(),
                value: d.value,
            }));
            return { items };
        }),
});

export type DespesasRouter = typeof despesasRouter;
// ============================================================
// FIM DO ARQUIVO MERGED: server/api/routers/despesas.ts
// ============================================================