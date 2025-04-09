// server/api/routers/empreendimentos.ts
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createEmpreendimentoSchema,
    updateEmpreendimentoSchema,
    empreendimentoFilterSchema,
    empreendimentoListResponseSchema,
    empreendimentoResponseSchema,
    EmpreendimentoStatus,
    EmpreendimentoType,
    type UpdateEmpreendimentoInput
} from '../schemas/empreendimentos';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Despesa, Documento, User, EmpreendimentoDocument } from '@/lib/db/models';
import { createEmpreendimentoFolders } from '@/lib/google/drive';
import { createEmpreendimentoSheet } from '@/lib/google/sheets';
import mongoose, { Types, FilterQuery, PipelineStage } from 'mongoose';
import type { Context } from '../context';
import { format, parseISO, isValid as isDateValid } from 'date-fns';

// Helper para parsear datas
const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
    if (!dateInput) return undefined;
    try {
        let date;
        if (typeof dateInput === 'string') { date = parseISO(dateInput); }
        else if (dateInput instanceof Date) { date = dateInput; }
        else { return undefined; }
        return isDateValid(date) ? date : undefined;
    } catch (e) { console.warn("safeParseDate error:", e); return undefined; }
};

// *** Helper para Validar URL (Simples) ***
const isValidHttpUrl = (string: string | null | undefined): boolean => {
  if (!string) return false;
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

// Interface PopulatedLeanEmpreendimento (sem alterações)
interface PopulatedLeanEmpreendimento {
  _id: Types.ObjectId; name: string; address: string; type: EmpreendimentoType; status: EmpreendimentoStatus; totalUnits: number; soldUnits: number; startDate: Date; endDate: Date; description?: string | null; responsiblePerson: string; contactEmail: string; contactPhone: string; image?: string | null; folderId?: string | null; sheetId?: string | null; createdBy?: { _id: Types.ObjectId; name: string } | null; createdAt: Date; updatedAt: Date; pendingExpensesCount?: number; totalExpensesValue?: number;
}

// Helper buildEmpreendimentoFilter (sem alterações)
const buildEmpreendimentoFilter = (inputFilters: z.infer<typeof empreendimentoFilterSchema>, ctxUser: Context['user']): FilterQuery<EmpreendimentoDocument> => {
    // ... (lógica do filtro como antes) ...
     if (!ctxUser) throw new TRPCError({ code: 'UNAUTHORIZED' });
     const filter: FilterQuery<EmpreendimentoDocument> = {};
     const { searchTerm, status, type } = inputFilters;
     if (searchTerm) { filter.name = { $regex: searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; }
     if (status && status !== 'todos') filter.status = status;
     if (type && type !== 'todos') filter.type = type;
     if (ctxUser.role !== 'admin') {
        const assignedIdsString = ctxUser.assignedEmpreendimentos || [];
        const validAssignedObjectIds = assignedIdsString.filter(id => mongoose.isValidObjectId(id)).map(id => new Types.ObjectId(id));
        filter._id = { $in: validAssignedObjectIds.length > 0 ? validAssignedObjectIds : [new Types.ObjectId()] };
     }
     return filter;
};


export const empreendimentosRouter = router({
  // Listar todos os empreendimentos
  getAll: protectedProcedure
    .input(empreendimentoFilterSchema)
    .output(empreendimentoListResponseSchema)
    .query(async ({ input, ctx }): Promise<z.infer<typeof empreendimentoListResponseSchema>> => {
      console.log("[tRPC empreendimentos.getAll] START Input:", JSON.stringify(input));
      try {
        await connectToDatabase();
        const { page, limit, sortBy = 'updatedAt', sortOrder = 'desc' } = input;
        const skip = (page - 1) * limit;
        const filter = buildEmpreendimentoFilter(input, ctx.user);

        if (filter._id instanceof Types.ObjectId) {
            console.log("[tRPC getAll] Filtro impossível. Retornando vazio.");
            return { empreendimentos: [], pagination: { total: 0, limit, page, pages: 0, hasMore: false } };
        }

        const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
        if (sortBy !== '_id') sortCriteria['_id'] = -1;

        console.log("[tRPC getAll] Filtro Final:", JSON.stringify(filter));
        console.log("[tRPC getAll] Sort:", JSON.stringify(sortCriteria));

        const aggregationPipeline: PipelineStage[] = [
            { $match: filter },
            { $lookup: { from: 'despesas', localField: '_id', foreignField: 'empreendimento', as: 'relatedExpenses' }},
            { $addFields: {
                pendingExpensesCount: { $size: { $filter: { input: '$relatedExpenses', as: 'expense', cond: { $and: [ { $in: ['$$expense.status', ['Pendente', 'A vencer']] }, { $ne: ['$$expense.approvalStatus', 'Rejeitado'] } ]} } } },
                totalExpensesValue: { $sum: { $map: { input: { $filter: { input: '$relatedExpenses', as: 'expense', cond: { $in: ['$$expense.status', ['Pago', 'A vencer']] } } }, as: "approvedExpense", in: "$$approvedExpense.value" } } }
            }},
            { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'creatorInfo' }},
            { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true }},
            { $sort: sortCriteria },
            { $skip: skip },
            { $limit: limit },
            { $project: {
                _id: 1, name: 1, address: 1, type: 1, status: 1, totalUnits: 1, soldUnits: 1, startDate: 1, endDate: 1, description: 1, responsiblePerson: 1, contactEmail: 1, contactPhone: 1, image: 1, folderId: 1, sheetId: 1, createdAt: 1, updatedAt: 1,
                createdBy: { _id: '$creatorInfo._id', name: '$creatorInfo.name' },
                pendingExpensesCount: 1, totalExpensesValue: 1,
                // relatedExpenses: 0 // Opcional
            }}
        ];

        const [empreendimentosDocs, total] = await Promise.all([
            Empreendimento.aggregate<PopulatedLeanEmpreendimento>(aggregationPipeline),
            Empreendimento.countDocuments(filter)
        ]);

        console.log(`[tRPC getAll] Docs Agregados: ${empreendimentosDocs.length}, Total Contagem: ${total}`);

        // *** CORREÇÃO NO MAPEAMENTO DO CAMPO 'image' ***
        const clientEmpreendimentos = empreendimentosDocs.map(emp => {
            // Verifica se 'image' é uma URL válida antes de incluir
            const validImageUrl = isValidHttpUrl(emp.image) ? emp.image : null;
            if (emp.image && !validImageUrl) {
                console.warn(`[tRPC getAll Map] URL de imagem inválida encontrada para emp ${emp._id}: "${emp.image}". Será retornada como null.`);
            }

            return {
                _id: emp._id.toString(),
                name: emp.name ?? 'Nome Indisponível',
                address: emp.address ?? 'Endereço Indisponível',
                type: emp.type,
                status: emp.status,
                totalUnits: emp.totalUnits ?? 0,
                soldUnits: emp.soldUnits ?? 0,
                startDate: emp.startDate?.toISOString() ?? new Date(0).toISOString(),
                endDate: emp.endDate?.toISOString() ?? new Date(0).toISOString(),
                description: emp.description ?? null,
                responsiblePerson: emp.responsiblePerson ?? 'N/A',
                contactEmail: emp.contactEmail ?? 'N/A',
                contactPhone: emp.contactPhone ?? 'N/A',
                image: validImageUrl, // Passa a URL validada ou null
                folderId: emp.folderId ?? null,
                sheetId: emp.sheetId ?? null,
                createdBy: emp.createdBy ? { _id: emp.createdBy._id?.toString() ?? '', name: emp.createdBy.name ?? 'N/A' } : undefined,
                createdAt: emp.createdAt?.toISOString() ?? new Date(0).toISOString(),
                updatedAt: emp.updatedAt?.toISOString() ?? new Date(0).toISOString(),
                pendingExpenses: emp.pendingExpensesCount ?? 0,
                totalExpenses: emp.totalExpensesValue ?? 0,
            };
        });

        console.log("[tRPC getAll] Validando resposta com Zod...");
        const response = {
           empreendimentos: clientEmpreendimentos,
           pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total, },
        };
        const parsedResponse = empreendimentoListResponseSchema.parse(response);
        console.log("[tRPC getAll] Resposta validada. Enviando.");
        console.log("=======================================");
        return parsedResponse;

      } catch (error) {
        console.error('[tRPC empreendimentos.getAll] ERRO CAPTURADO:', error);
         if (error instanceof z.ZodError) { console.error('[tRPC getAll] Zod Error:', error.issues); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro validação interna (getAll).', cause: error }); }
         if (error instanceof mongoose.mongo.MongoServerError) { console.error('[tRPC getAll] MongoServerError:', error); }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao listar empreendimentos', cause: error instanceof Error ? error.message : String(error), });
      }
    }),

  // --- getById (Adicionar validação de URL também) ---
  getById: protectedProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id), { message: "ID inválido" }) }))
    .output(empreendimentoResponseSchema)
    .query(async ({ input, ctx }) => {
      console.log(`[tRPC getById] ID: ${input.id}`);
      try {
        await connectToDatabase();
        const empreendimentoDoc = await Empreendimento.findById(input.id)
          .populate<{ createdBy: { _id: Types.ObjectId; name: string } | null }>('createdBy', 'name _id')
          .lean<PopulatedLeanEmpreendimento | null>();
        if (!empreendimentoDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' });

        const canView = ctx.user.role === 'admin' || ctx.user.role === 'manager' || (ctx.user.assignedEmpreendimentos || []).includes(empreendimentoDoc._id.toString());
        if (!canView) throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });

        console.log(`[tRPC getById] Dados encontrados para ${empreendimentoDoc.name}`);
        // *** CORREÇÃO NO MAPEAMENTO 'image' ***
        const validImageUrl = isValidHttpUrl(empreendimentoDoc.image) ? empreendimentoDoc.image : null;
        if (empreendimentoDoc.image && !validImageUrl) {
            console.warn(`[tRPC getById Map] URL de imagem inválida para emp ${empreendimentoDoc._id}: "${empreendimentoDoc.image}". Será retornada como null.`);
        }

        return empreendimentoResponseSchema.parse({
            _id: empreendimentoDoc._id.toString(),
            name: empreendimentoDoc.name ?? 'N/A',
            address: empreendimentoDoc.address ?? 'N/A',
            type: empreendimentoDoc.type,
            status: empreendimentoDoc.status,
            totalUnits: empreendimentoDoc.totalUnits ?? 0,
            soldUnits: empreendimentoDoc.soldUnits ?? 0,
            startDate: empreendimentoDoc.startDate?.toISOString() ?? new Date(0).toISOString(),
            endDate: empreendimentoDoc.endDate?.toISOString() ?? new Date(0).toISOString(),
            description: empreendimentoDoc.description ?? null,
            responsiblePerson: empreendimentoDoc.responsiblePerson ?? 'N/A',
            contactEmail: empreendimentoDoc.contactEmail ?? 'N/A',
            contactPhone: empreendimentoDoc.contactPhone ?? 'N/A',
            image: validImageUrl, // Usa a URL validada ou null
            folderId: empreendimentoDoc.folderId ?? null,
            sheetId: empreendimentoDoc.sheetId ?? null,
            createdBy: empreendimentoDoc.createdBy ? { _id: empreendimentoDoc.createdBy._id.toString(), name: empreendimentoDoc.createdBy.name ?? 'N/A' } : undefined,
            createdAt: empreendimentoDoc.createdAt?.toISOString() ?? new Date(0).toISOString(),
            updatedAt: empreendimentoDoc.updatedAt?.toISOString() ?? new Date(0).toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) { console.error('[tRPC getById] Zod Error:', error.issues); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro validação (getById).', cause: error }); }
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC getById] Erro:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar' });
      }
    }),

    // --- create (sem alterações, já aceita image opcional) ---
    create: adminProcedure
    .input(createEmpreendimentoSchema)
    .mutation(async ({ input, ctx }) => {
        console.log("[tRPC create] Input:", { ...input, image: input.image ? '<URL fornecida>' : input.image });
        try {
            await connectToDatabase();
            const parsedStartDate = safeParseDate(input.startDate); const parsedEndDate = safeParseDate(input.endDate);
            if (!parsedStartDate || !parsedEndDate || !isDateValid(parsedStartDate) || !isDateValid(parsedEndDate) || parsedStartDate > parsedEndDate) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas inválidas.' }); }
            const newEmpreendimento = new Empreendimento({ ...input, startDate: parsedStartDate, endDate: parsedEndDate, image: input.image ?? undefined, createdBy: new Types.ObjectId(ctx.user.id) });
            await newEmpreendimento.save(); console.log(`[tRPC create] Empr ${newEmpreendimento._id} salvo.`);
            let folderId: string | null = null; let sheetId: string | null = null; let sheetUrl: string | undefined = undefined;
            try { const folderResult = await createEmpreendimentoFolders(newEmpreendimento._id.toString(), newEmpreendimento.name); if (folderResult.success && folderResult.empreendimentoFolderId) { folderId = folderResult.empreendimentoFolderId; newEmpreendimento.folderId = folderId; } } catch (driveError: any) { console.error(`Erro pasta Drive: ${driveError.message}`); }
            try { const sheetResult = await createEmpreendimentoSheet(newEmpreendimento._id.toString(), newEmpreendimento.name); if (sheetResult.success && sheetResult.spreadsheetId) { sheetId = sheetResult.spreadsheetId; sheetUrl = sheetResult.url; newEmpreendimento.sheetId = sheetId; } } catch (sheetError: any) { console.error(`Erro planilha Sheets: ${sheetError.message}`); }
            if (folderId || sheetId) await newEmpreendimento.save();
            return { success: true, message: 'Criado' + (!folderId || !sheetId ? ' (integração Google falhou).' : '.'), empreendimento: { id: newEmpreendimento._id.toString(), name: newEmpreendimento.name, folderId, sheetId, sheetUrl }, };
        } catch (error) { if (error instanceof TRPCError) throw error; if (error instanceof mongoose.Error.ValidationError) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error }); console.error('[tRPC create] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar', cause: error instanceof Error ? error.message : String(error), }); }
    }),

    // --- update (sem alterações, já aceita image opcional) ---
    update: adminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)), data: updateEmpreendimentoSchema }))
    .mutation(async ({ input }) => {
        console.log(`[tRPC update] ID: ${input.id}`);
        try {
            await connectToDatabase();
            const updatePayload: { [key: string]: any } = { updatedAt: new Date() };
            for (const [key, value] of Object.entries(input.data)) { if (value !== undefined) { if (key === 'startDate' || key === 'endDate') { const parsedDate = safeParseDate(value as string | Date); if (parsedDate) { updatePayload[key] = parsedDate; } else if (value === null) { updatePayload[key] = null; } } else { updatePayload[key] = value; } } }
            const existingEmp = await Empreendimento.findById(input.id).select('startDate endDate').lean();
            const finalStartDate = updatePayload.startDate ?? existingEmp?.startDate; const finalEndDate = updatePayload.endDate ?? existingEmp?.endDate;
            if (finalStartDate && finalEndDate && isDateValid(finalStartDate) && isDateValid(finalEndDate) && finalStartDate > finalEndDate) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Início > Conclusão.' }); }
            console.log('[tRPC update] Dados $set:', updatePayload);
            const updatedEmpreendimento = await Empreendimento.findByIdAndUpdate( input.id, { $set: updatePayload }, { new: true, runValidators: true } ).lean<PopulatedLeanEmpreendimento | null>();
            if (!updatedEmpreendimento) throw new TRPCError({ code: 'NOT_FOUND', message: 'Não encontrado' }); console.log(`[tRPC update] Empr ${input.id} atualizado.`);
            return { success: true, message: 'Atualizado', empreendimento: { id: updatedEmpreendimento._id.toString(), name: updatedEmpreendimento.name, image: updatedEmpreendimento.image ?? null }, };
        } catch (error) { if (error instanceof TRPCError) throw error; if (error instanceof mongoose.Error.ValidationError) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error }); console.error('[tRPC update] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar', cause: error instanceof Error ? error.message : String(error), }); }
    }),

    // --- delete (sem alterações) ---
    delete: adminProcedure
    .input(z.object({ id: z.string().refine(id => mongoose.isValidObjectId(id)) }))
    .mutation(async ({ input }) => {
        console.log(`[tRPC delete] ID: ${input.id}`);
        try {
            await connectToDatabase();
            const [despesasCount, documentosCount] = await Promise.all([ Despesa.countDocuments({ empreendimento: new Types.ObjectId(input.id) }), Documento.countDocuments({ empreendimento: new Types.ObjectId(input.id) }) ]);
            if (despesasCount > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `Existem ${despesasCount} despesa(s).` });
            if (documentosCount > 0) throw new TRPCError({ code: 'BAD_REQUEST', message: `Existem ${documentosCount} documento(s).` });
            const deleted = await Empreendimento.findByIdAndDelete(input.id);
            if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Não encontrado' }); console.log(`[tRPC delete] Empr ${input.id} excluído.`);
            return { success: true, message: 'Excluído' };
        } catch (error) { if (error instanceof TRPCError) throw error; console.error('[tRPC delete] Erro:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao excluir', cause: error instanceof Error ? error.message : String(error),}); }
    }),
});

export type EmpreendimentosRouter = typeof empreendimentosRouter;