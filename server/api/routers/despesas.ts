// ============================================================
// START OF REFACTORED FILE: server/api/routers/despesas.ts
// ============================================================
import { router, protectedProcedure, adminProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento, User, DespesaDocument } from '@/lib/db/models';
import mongoose, { Types, FilterQuery } from 'mongoose';
import { addDespesaToSheet, updateDespesaInSheet, deleteDespesaFromSheet } from '@/lib/google/sheets';
import { format, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, parseISO, isValid as isDateValid } from 'date-fns';
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
  despesaComparisonItemSchema,
  monthlySummaryItemSchema,
  despesaCategorySchema,
  DespesaStatus,
  DespesaApprovalStatus,
  DespesaCategory,
  UpdateDespesaInput,
  despesaStatusSchema,
  despesaApprovalStatusSchema
} from '../schemas/despesas';
import type { Context } from '../context';

// Interface for Attachment
interface Attachment {
  _id?: Types.ObjectId | string;
  fileId?: string;
  name?: string;
  url?: string;
}

// Interface para dados de atualização
interface DespesaUpdatePayload {
  description?: string | null; value?: number | null; date?: Date | null; dueDate?: Date | null; status?: DespesaStatus | null; category?: DespesaCategory | null; paymentMethod?: string | null; notes?: string | null; attachments?: Attachment[] | null; updatedAt: Date; reviewedBy?: Types.ObjectId | undefined | null; reviewedAt?: Date | undefined | null; approvalStatus?: DespesaApprovalStatus | null; empreendimento?: Types.ObjectId | null;
}

// Interface para Despesa populada com lean
interface PopulatedLeanDespesa {
  _id: Types.ObjectId; description: string; value: number; date: Date; dueDate: Date; status: DespesaStatus; category: DespesaCategory; paymentMethod?: string; notes?: string; attachments?: Attachment[]; approvalStatus: DespesaApprovalStatus; createdAt: Date; updatedAt: Date; reviewedAt?: Date | null; empreendimento?: { _id: Types.ObjectId; name?: string; sheetId?: string; folderId?: string } | null; createdBy?: { _id: Types.ObjectId; name?: string } | null; reviewedBy?: { _id: Types.ObjectId; name?: string } | null;
}

// Helper to safely parse dates
const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
  if (!dateInput) return undefined; try { let date; if (typeof dateInput === 'string') date = parseISO(dateInput); else if (dateInput instanceof Date) date = dateInput; else return undefined; return isDateValid(date) ? date : undefined; } catch (e) { console.warn("safeParseDate error:", e); return undefined; }
};

// Helper function to build the RBAC filter
const buildDespesaFilter = (inputFilters: z.infer<typeof despesaFilterSchema>, ctxUser: Context['user']): FilterQuery<DespesaDocument> => {
  if (!ctxUser) throw new TRPCError({ code: 'UNAUTHORIZED' }); const filter: FilterQuery<DespesaDocument> = {}; const { empreendimento, status, category, approvalStatus, search, startDate, endDate } = inputFilters;
  if (ctxUser.role === 'user') { const assignedIds = (ctxUser.assignedEmpreendimentos || []).filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id)); if (assignedIds.length === 0) filter._id = new Types.ObjectId(); else filter.empreendimento = { $in: assignedIds }; }
  if (empreendimento && empreendimento !== 'todos' && mongoose.isValidObjectId(empreendimento)) { const requestedEmpId = new Types.ObjectId(empreendimento); const userCanAccessRequested = ctxUser.role !== 'user' || (ctxUser.assignedEmpreendimentos || []).includes(empreendimento); if (userCanAccessRequested) { if (ctxUser.role !== 'user' || filter.empreendimento === undefined) filter.empreendimento = requestedEmpId; else if (filter.empreendimento?.$in && filter.empreendimento.$in.some((id: Types.ObjectId) => id.equals(requestedEmpId))) filter.empreendimento = requestedEmpId; else filter._id = new Types.ObjectId(); } else filter._id = new Types.ObjectId(); }
  if (status?.length) filter.status = { $in: status }; if (category) filter.category = category; if (approvalStatus) filter.approvalStatus = approvalStatus;
  if (search) { const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = [{ description: { $regex: escapedSearch, $options: 'i' } }, { notes: { $regex: escapedSearch, $options: 'i' } }]; }
  if (startDate || endDate) { filter.dueDate = {}; const parsedStartDate = safeParseDate(startDate); const parsedEndDate = safeParseDate(endDate); if (parsedStartDate) filter.dueDate.$gte = startOfDay(parsedStartDate); if (parsedEndDate) filter.dueDate.$lte = endOfDay(parsedEndDate); if (!filter.dueDate.$gte && !filter.dueDate.$lte) delete filter.dueDate; else if (filter.dueDate.$gte && filter.dueDate.$lte && filter.dueDate.$gte > filter.dueDate.$lte) filter._id = new Types.ObjectId(); }
  console.log("[buildDespesaFilter] Final Filter:", JSON.stringify(filter)); return filter;
};

/**
 * Roteador para despesas (tRPC)
 */
export const despesasRouter = router({
  // Listar todas as despesas
  getAll: protectedProcedure.input(despesaFilterSchema).output(despesaListResponseSchema).query(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const { page, limit, sortBy = 'dueDate', sortOrder = 'desc' } = input; const skip = (page - 1) * limit; const filter = buildDespesaFilter(input, ctx.user);
      if (filter._id instanceof Types.ObjectId && filter._id.toString().length > 0) return { despesas: [], pagination: { total: 0, limit, page, pages: 0, hasMore: false } };
      const sortCriteria: { [key: string]: 1 | -1 } = {}; sortCriteria[sortBy] = sortOrder === 'asc' ? 1 : -1; if (sortBy !== '_id') sortCriteria['_id'] = -1;
      const [despesas, total] = await Promise.all([Despesa.find(filter).sort(sortCriteria).skip(skip).limit(limit).populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', '_id name').populate<{ createdBy: { _id: Types.ObjectId; name?: string } | null }>('createdBy', '_id name').populate<{ reviewedBy: { _id: Types.ObjectId; name?: string } | null }>('reviewedBy', '_id name').lean<PopulatedLeanDespesa[]>(), Despesa.countDocuments(filter)]);
      const formattedDespesas = despesas.map(despesa => despesaResponseSchema.parse({ _id: despesa._id.toString(), description: despesa.description, value: despesa.value, date: despesa.date.toISOString(), dueDate: despesa.dueDate.toISOString(), status: despesa.status, approvalStatus: despesa.approvalStatus ?? 'Pendente', category: despesa.category, paymentMethod: despesa.paymentMethod ?? null, notes: despesa.notes ?? null, empreendimento: despesa.empreendimento ? { _id: despesa.empreendimento._id.toString(), name: despesa.empreendimento.name ?? 'N/A', } : undefined, createdBy: despesa.createdBy ? { _id: despesa.createdBy._id.toString(), name: despesa.createdBy.name ?? 'N/A', } : undefined, reviewedBy: despesa.reviewedBy ? { _id: despesa.reviewedBy._id.toString(), name: despesa.reviewedBy.name ?? 'N/A', } : undefined, reviewedAt: despesa.reviewedAt?.toISOString() ?? null, attachments: despesa.attachments?.map(att => ({ _id: att._id?.toString(), fileId: att.fileId, name: att.name, url: att.url, })) ?? [], createdAt: despesa.createdAt.toISOString(), updatedAt: despesa.updatedAt?.toISOString() ?? despesa.createdAt.toISOString(), }));
      return { despesas: formattedDespesas, pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total, }, };
    } catch (error) { if (error instanceof z.ZodError) { console.error('[tRPC despesas.getAll] Zod Validation Error:', error.issues); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro na validação dos dados da despesa.', cause: error }); } console.error('Erro ao listar despesas via tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar despesas' }); }
  }),

  // Obter despesa por ID
  getById: protectedProcedure.input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) })).output(despesaResponseSchema).query(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const userRole = ctx.user.role; const userId = new Types.ObjectId(ctx.user.id); const userAssignedEmpreendimentos = (ctx.user.assignedEmpreendimentos || []).filter(id => mongoose.isValidObjectId(id)).map(id => id.toString());
      const despesa = await Despesa.findById(input.id).populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', '_id name').populate<{ createdBy: { _id: Types.ObjectId; name?: string } | null }>('createdBy', '_id name').populate<{ reviewedBy: { _id: Types.ObjectId; name?: string } | null }>('reviewedBy', '_id name').lean<PopulatedLeanDespesa | null>();
      if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada' });
      const canView = userRole === 'admin' || userRole === 'manager' || (userRole === 'user' && despesa.createdBy?._id.equals(userId)) || (userRole === 'user' && userAssignedEmpreendimentos.includes(despesa.empreendimento?._id.toString() ?? '')); if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
      return despesaResponseSchema.parse({ _id: despesa._id.toString(), description: despesa.description, value: despesa.value, date: despesa.date.toISOString(), dueDate: despesa.dueDate.toISOString(), status: despesa.status, approvalStatus: despesa.approvalStatus ?? 'Pendente', category: despesa.category, paymentMethod: despesa.paymentMethod ?? null, notes: despesa.notes ?? null, empreendimento: despesa.empreendimento ? { _id: despesa.empreendimento._id.toString(), name: despesa.empreendimento.name ?? 'N/A', } : undefined, createdBy: despesa.createdBy ? { _id: despesa.createdBy._id.toString(), name: despesa.createdBy.name ?? 'N/A', } : undefined, reviewedBy: despesa.reviewedBy ? { _id: despesa.reviewedBy._id.toString(), name: despesa.reviewedBy.name ?? 'N/A', } : undefined, reviewedAt: despesa.reviewedAt?.toISOString() ?? null, attachments: despesa.attachments?.map(att => ({ _id: att._id?.toString(), fileId: att.fileId, name: att.name, url: att.url, })) ?? [], createdAt: despesa.createdAt.toISOString(), updatedAt: despesa.updatedAt?.toISOString() ?? despesa.createdAt.toISOString(), });
    } catch (error) { if (error instanceof z.ZodError) { console.error('[tRPC despesas.getById] Zod Error:', error.issues); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro validação getById.', cause: error }); } if (error instanceof TRPCError) throw error; console.error('Erro getById despesa tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar despesa' }); }
  }),

  // Criar despesa
  create: protectedProcedure.input(createDespesaSchema).mutation(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const userRole = ctx.user.role; const userId = new Types.ObjectId(ctx.user.id); const userAssignedEmpreendimentos = (ctx.user.assignedEmpreendimentos || []).filter(id => mongoose.isValidObjectId(id)).map(id => id.toString());
      const empreendimento = await Empreendimento.findById(input.empreendimento).select('_id name sheetId').lean(); if (!empreendimento) throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' });
      if (userRole === 'user' && !userAssignedEmpreendimentos.includes(empreendimento._id.toString())) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
      const approvalStatus: DespesaApprovalStatus = userRole === 'admin' ? 'Aprovado' : 'Pendente'; const reviewedBy = approvalStatus === 'Aprovado' ? userId : undefined; const reviewedAt = approvalStatus === 'Aprovado' ? new Date() : undefined; let finalStatus: DespesaStatus = input.status; if (approvalStatus === 'Aprovado' && input.status !== 'Pago') finalStatus = 'A vencer';
      const parsedDate = safeParseDate(input.date); const parsedDueDate = safeParseDate(input.dueDate); if (!parsedDate || !parsedDueDate || parsedDate > parsedDueDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas inválidas.' });
      // Prepare data without incorrect type hint
      const despesaDataToCreate = { ...input, date: parsedDate, dueDate: parsedDueDate, status: finalStatus, empreendimento: new Types.ObjectId(input.empreendimento), createdBy: userId, approvalStatus, reviewedBy, reviewedAt, paymentMethod: input.paymentMethod || undefined, notes: input.notes || undefined, attachments: [], }; // Initialize attachments
      const newDespesa = await Despesa.create(despesaDataToCreate); // Mongoose create returns typed doc
      // FIX: Access _id directly from the returned document
      if (!newDespesa?._id) throw new Error("Failed to create despesa document."); // Check if creation succeeded
      const newDespesaIdString = newDespesa._id.toString();
      console.log(`[tRPC despesas.create] Despesa criada com ID: ${newDespesaIdString}`);
      if (empreendimento.sheetId && approvalStatus === 'Aprovado') {
        const sheetData = { _id: newDespesaIdString, description: newDespesa.description, value: newDespesa.value, date: newDespesa.date, dueDate: newDespesa.dueDate, status: newDespesa.status, category: newDespesa.category, paymentMethod: newDespesa.paymentMethod || '', notes: newDespesa.notes || '', };
        await addDespesaToSheet(empreendimento.sheetId, sheetData).catch(err => console.error('[tRPC create] Erro add sheet:', err));
      }
      return { success: true, message: approvalStatus === 'Aprovado' ? 'Despesa criada e aprovada' : 'Despesa criada, aguardando aprovação', despesa: { id: newDespesaIdString }, };
    } catch (error) { if (error instanceof TRPCError) throw error; if (error instanceof mongoose.Error.ValidationError) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error }); console.error('Erro criar despesa tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar despesa' }); }
  }),

  // Atualizar despesa
  update: protectedProcedure.input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)), data: updateDespesaSchema, })).mutation(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const userRole = ctx.user.role; const userId = new Types.ObjectId(ctx.user.id);
      const despesa = await Despesa.findById(input.id); if (!despesa) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada' });
      const isCreator = despesa.createdBy.equals(userId); const canEdit = userRole === 'admin' || (isCreator && despesa.approvalStatus === 'Pendente'); if (!canEdit) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para editar' });
      const updatePayload: DespesaUpdatePayload = { updatedAt: new Date() };
      const dataToUpdate: UpdateDespesaInput = input.data;
      for (const key of Object.keys(dataToUpdate) as Array<keyof UpdateDespesaInput>) { const value = dataToUpdate[key]; if (value !== undefined) { if (key === 'date' || key === 'dueDate') { const parsedDate = safeParseDate(value as string | Date); if (parsedDate) updatePayload[key as 'date' | 'dueDate'] = parsedDate; } else if (key === 'paymentMethod' || key === 'notes') { updatePayload[key as 'paymentMethod' | 'notes'] = value === null ? null : String(value); } else if (key !== 'attachments') { if (['description', 'value', 'status', 'category'].includes(key)) { (updatePayload as any)[key] = value; } } } }
      const finalDate = updatePayload.date ?? despesa.date; const finalDueDate = updatePayload.dueDate ?? despesa.dueDate; if (finalDate && finalDueDate && finalDate > finalDueDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data não pode ser posterior ao vencimento.' });
      // Assert type after update call
      const updatedDespesaDoc = await Despesa.findByIdAndUpdate(input.id, { $set: updatePayload }, { new: true, runValidators: true }).populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string } | null }>('empreendimento', '_id sheetId') as (DespesaDocument & { _id: Types.ObjectId; empreendimento?: { _id: Types.ObjectId; sheetId?: string } | null }) | null;
      if (!updatedDespesaDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Falha ao atualizar' });
      const empSheetId = updatedDespesaDoc.empreendimento?.sheetId;
      console.log(`[Update] Despesa ${input.id} atualizada. Sheet ID: ${empSheetId}`);
      // FIX: Access _id safely
      const updatedDespesaIdString = updatedDespesaDoc._id.toString();
      if (updatedDespesaDoc.approvalStatus === 'Aprovado' && empSheetId) {
        const sheetData = { _id: updatedDespesaIdString, /* ... */ description: updatedDespesaDoc.description, value: updatedDespesaDoc.value, date: updatedDespesaDoc.date, dueDate: updatedDespesaDoc.dueDate, status: updatedDespesaDoc.status, category: updatedDespesaDoc.category, paymentMethod: updatedDespesaDoc.paymentMethod || '', notes: updatedDespesaDoc.notes || '' };
        await updateDespesaInSheet(empSheetId, updatedDespesaIdString, sheetData).catch(err => console.error('[Update] Erro sheet update:', err));
      }
      // FIX: Access _id safely
      return { success: true, message: 'Despesa atualizada', despesa: { id: updatedDespesaIdString, description: updatedDespesaDoc.description }, };
    } catch (error) { if (error instanceof TRPCError) throw error; console.error('Erro update despesa tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar' }); }
  }),

  // Revisar despesa
  review: adminProcedure.input(reviewDespesaSchema.extend({ id: z.string().refine(id => mongoose.isValidObjectId(id)) })).mutation(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const userId = new Types.ObjectId(ctx.user.id);
      // Assert type after findById
      const despesaDoc = await Despesa.findById(input.id).populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string } | null }>('empreendimento', '_id sheetId') as (DespesaDocument & { _id: Types.ObjectId; empreendimento?: { _id: Types.ObjectId; sheetId?: string } | null }) | null;
      if (!despesaDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada' });
      if (despesaDoc.approvalStatus !== 'Pendente') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Despesa já revisada' });
      let newStatus: DespesaStatus; if (input.approvalStatus === 'Aprovado') { newStatus = despesaDoc.status === 'Pago' ? 'Pago' : 'A vencer'; } else { newStatus = 'Rejeitado'; }
      despesaDoc.approvalStatus = input.approvalStatus; despesaDoc.reviewedBy = userId; despesaDoc.reviewedAt = new Date(); despesaDoc.status = newStatus; if (input.notes) despesaDoc.notes = input.notes; despesaDoc.updatedAt = new Date();
      await despesaDoc.save();
      // FIX: Access _id safely
      const despesaIdString = despesaDoc._id.toString();
      console.log(`[Review] Despesa ${despesaIdString} salva. Status: ${despesaDoc.approvalStatus}/${despesaDoc.status}.`);
      const empSheetId = despesaDoc.empreendimento?.sheetId;
      // FIX: Access _id safely
      if (input.approvalStatus === 'Aprovado' && empSheetId) { const sheetData = { _id: despesaIdString, /* ... */ description: despesaDoc.description, value: despesaDoc.value, date: despesaDoc.date, dueDate: despesaDoc.dueDate, status: despesaDoc.status, category: despesaDoc.category, paymentMethod: despesaDoc.paymentMethod || '', notes: despesaDoc.notes || '' }; const updateResult = await updateDespesaInSheet(empSheetId, despesaIdString, sheetData); if (!updateResult.success) { await addDespesaToSheet(empSheetId, sheetData).catch(err => console.error('[Review] Erro add sheet:', err)); } }
      else if (input.approvalStatus === 'Rejeitado' && empSheetId) { await deleteDespesaFromSheet(empSheetId, despesaIdString).catch(err => console.error('[Review] Erro delete sheet:', err)); } // FIX: Access _id safely
      // FIX: Access _id safely
      return { success: true, message: `Despesa ${input.approvalStatus === 'Aprovado' ? 'aprovada' : 'rejeitada'}`, despesa: { id: despesaIdString, approvalStatus: despesaDoc.approvalStatus, status: despesaDoc.status }, };
    } catch (error) { if (error instanceof TRPCError) throw error; console.error('Erro review despesa tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao revisar' }); }
  }),

  // Excluir despesa
  delete: protectedProcedure.input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) })).mutation(async ({ input, ctx }) => {
    try {
      await connectToDatabase(); const userRole = ctx.user.role; const userId = new Types.ObjectId(ctx.user.id);
      // Assert type after findById
      const despesaDoc = await Despesa.findById(input.id).populate<{ empreendimento: { _id: Types.ObjectId; sheetId?: string } | null }>('empreendimento', '_id sheetId') as (DespesaDocument & { _id: Types.ObjectId; empreendimento?: { _id: Types.ObjectId; sheetId?: string } | null }) | null;
      if (!despesaDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Despesa não encontrada' });
      const isCreator = despesaDoc.createdBy.equals(userId); const isPending = despesaDoc.approvalStatus === 'Pendente'; const canDelete = userRole === 'admin' || (isCreator && isPending); if (!canDelete) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para excluir' });
      await Despesa.findByIdAndDelete(input.id);
      const empSheetId = despesaDoc.empreendimento?.sheetId;
      // FIX: Access _id safely
      if (empSheetId) { await deleteDespesaFromSheet(empSheetId, despesaDoc._id.toString()).catch(err => console.error('[Delete] Erro sheet delete:', err)); }
      return { success: true, message: 'Despesa excluída' };
    } catch (error) { if (error instanceof TRPCError) throw error; console.error('Erro delete despesa tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir' }); }
  }),

  // Listar categorias
  getCategories: publicProcedure.output(z.array(despesaCategorySchema)).query(() => despesaCategorySchema.options),

  // Comparação por categoria
  getComparisonByCategory: protectedProcedure
    .input(z.object({
      startDate: z.string().datetime({ message: "Data inicial inválida" }),
      endDate: z.string().datetime({ message: "Data final inválida" }),
      empreendimentoId: z.string().optional(),
    }))
    .output(z.array(despesaComparisonItemSchema))
    .query(async ({ input, ctx }) => {
      console.log("[tRPC despesas.getComparisonByCategory] Input:", input);
      try {
        await connectToDatabase();
        const { startDate, endDate } = input;
        // Use a temporary filter object based on input for the helper
        const filterInputForHelper = { ...input, page: 1, limit: 9999 };
        const filter = buildDespesaFilter(filterInputForHelper, ctx.user);

        // *** FIX: Filter by expense 'date' instead of 'dueDate' ***
        filter.approvalStatus = 'Aprovado'; // Still only approved
        filter.date = { // Filter by expense date
          $gte: startOfDay(new Date(startDate)),
          $lte: endOfDay(new Date(endDate))
        };
        delete filter.dueDate; // Remove dueDate filter if it was added by helper

        console.log("[tRPC despesas.getComparisonByCategory] Filtro:", JSON.stringify(filter));

        const stats = await Despesa.aggregate([
          { $match: filter },
          { $group: { _id: '$category', totalValue: { $sum: '$value' }, count: { $sum: 1 } } },
          { $project: { _id: 0, category: '$_id', totalValue: 1, count: 1 } },
          { $sort: { category: 1 } }
        ]);

        console.log("[tRPC despesas.getComparisonByCategory] Resultado Agregação:", JSON.stringify(stats));
        return z.array(despesaComparisonItemSchema).parse(stats);
      } catch (error) {
        console.error('Erro ao obter comparação por categoria via tRPC:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao obter comparação' });
      }
    }),


  // Resumo mensal
  getMonthlySummary: protectedProcedure
    .input(z.object({
      startDate: z.string().datetime({ message: "Data inicial inválida" }),
      endDate: z.string().datetime({ message: "Data final inválida" }),
      empreendimentoId: z.string().optional(),
    }))
    .output(z.array(monthlySummaryItemSchema))
    .query(async ({ input, ctx }) => {
      console.log("[tRPC despesas.getMonthlySummary] Input:", input);
      try {
        await connectToDatabase();
        const { startDate, endDate } = input;
        // Use a temporary filter object based on input for the helper
        const filterInputForHelper = { ...input, page: 1, limit: 9999 };
        const filter = buildDespesaFilter(filterInputForHelper, ctx.user);

        // *** FIX: Filter by expense 'date' instead of 'dueDate' ***
        filter.approvalStatus = 'Aprovado'; // Still only approved
        filter.date = { // Filter by expense date
          $gte: startOfDay(new Date(startDate)),
          $lte: endOfDay(new Date(endDate))
        };
        delete filter.dueDate; // Remove dueDate filter if it was added by helper

        console.log("[tRPC despesas.getMonthlySummary] Filtro:", JSON.stringify(filter));

        const monthlyStats = await Despesa.aggregate([
          { $match: filter },
          // Group by expense date month/year
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

        console.log("[tRPC despesas.getMonthlySummary] Resultado Agregação:", JSON.stringify(monthlyStats));
        return z.array(monthlySummaryItemSchema).parse(monthlyStats);
      } catch (error) {
        console.error('Erro ao obter resumo mensal via tRPC:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao obter resumo mensal' });
      }
    }),

  // Despesas pendentes de revisão
  listPendingReview: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(20).default(5), page: z.number().int().min(1).default(1) })).output(pendingApprovalsResponseSchema).query(async ({ input }) => {
    try { await connectToDatabase(); const { limit, page } = input; const skip = (page - 1) * limit; const [pending, total] = await Promise.all([Despesa.find({ approvalStatus: 'Pendente' }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate<{ empreendimento: { _id: Types.ObjectId; name?: string } | null }>('empreendimento', 'name _id').lean<PopulatedLeanDespesa[]>(), Despesa.countDocuments({ approvalStatus: 'Pendente' })]); const items = pending.map(d => ({ id: d._id.toString(), description: d.description, empreendimentoName: d.empreendimento?.name ?? 'N/A', value: d.value, createdAt: d.createdAt.toISOString(), })); return { items, pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total }, }; } catch (error) { console.error('Erro listPendingReview tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar pendentes' }); }
  }),

  // Resumo geral
  getGeneralSummary: protectedProcedure.input(z.object({ startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional(), empreendimentoId: z.string().optional(), status: z.array(despesaStatusSchema).optional(), category: despesaCategorySchema.optional(), approvalStatus: despesaApprovalStatusSchema.optional(), search: z.string().optional(), })).output(despesaSummarySchema).query(async ({ input, ctx }) => {
    try { await connectToDatabase(); const filterInput: z.infer<typeof despesaFilterSchema> = { page: 1, limit: 9999, empreendimento: input.empreendimentoId, status: input.status, category: input.category, approvalStatus: input.approvalStatus, search: input.search, startDate: input.startDate, endDate: input.endDate }; const filter = buildDespesaFilter(filterInput, ctx.user); if (input.startDate || input.endDate) { filter.dueDate = {}; const parsedStartDate = safeParseDate(input.startDate); const parsedEndDate = safeParseDate(input.endDate); if (parsedStartDate) filter.dueDate.$gte = startOfDay(parsedStartDate); if (parsedEndDate) filter.dueDate.$lte = endOfDay(parsedEndDate); if (!filter.dueDate.$gte && !filter.dueDate.$lte) delete filter.dueDate; else if (filter.dueDate.$gte && filter.dueDate.$lte && filter.dueDate.$gte > filter.dueDate.$lte) filter._id = new Types.ObjectId(); } const summary = await Despesa.aggregate([{ $match: filter }, { $group: { _id: null, totalValue: { $sum: '$value' }, totalCount: { $sum: 1 }, paidValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } }, dueValue: { $sum: { $cond: [{ $eq: ['$status', 'A vencer'] }, '$value', 0] } }, } },]); const data = summary[0] || { totalValue: 0, totalCount: 0, paidValue: 0, dueValue: 0 }; return despesaSummarySchema.parse({ totalValue: data.totalValue, totalCount: data.totalCount, paidValue: data.paidValue, dueValue: data.dueValue, /* Adjust if schema changes */ }); } catch (error) { console.error('Erro getGeneralSummary tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao obter resumo' }); }
  }),

  // Despesas próximas a vencer
  listUpcomingDue: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(20).default(5) })).output(upcomingExpensesResponseSchema).query(async ({ input, ctx }) => {
    try { await connectToDatabase(); const today = startOfDay(new Date()); const next7Days = endOfDay(addDays(today, 7)); const filter = buildDespesaFilter({ ...input, page: 1 }, ctx.user); filter.status = 'A vencer'; filter.approvalStatus = 'Aprovado'; filter.dueDate = { $gte: today, $lte: next7Days }; const upcoming = await Despesa.find(filter).sort({ dueDate: 1 }).limit(input.limit).lean<PopulatedLeanDespesa[]>(); const items = upcoming.map(d => ({ id: d._id.toString(), description: d.description, dueDate: d.dueDate.toISOString(), value: d.value, })); return { items }; } catch (error) { console.error('Erro listUpcomingDue tRPC:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar próximas' }); }
  }),
});

export type DespesasRouter = typeof despesasRouter;
// ============================================================
// END OF REFACTORED FILE: server/api/routers/despesas.ts
// ============================================================