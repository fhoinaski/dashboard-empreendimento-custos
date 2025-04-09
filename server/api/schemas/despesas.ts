import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados de despesas (tRPC)
 */

// --- Enums ---
export const despesaStatusSchema = z.enum(['Pago', 'Pendente', 'A vencer', 'Rejeitado'], {
    errorMap: () => ({ message: "Status inválido" })
});
export type DespesaStatus = z.infer<typeof despesaStatusSchema>;

export const despesaCategorySchema = z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'], {
    errorMap: () => ({ message: "Categoria inválida" })
});
export type DespesaCategory = z.infer<typeof despesaCategorySchema>;

export const despesaApprovalStatusSchema = z.enum(['Pendente', 'Aprovado', 'Rejeitado'], {
    errorMap: () => ({ message: "Status de aprovação inválido" })
});
export type DespesaApprovalStatus = z.infer<typeof despesaApprovalStatusSchema>;

// --- Schemas de Anexo ---
export const attachmentSchema = z.object({
  _id: z.string().optional(),
  fileId: z.string().optional(),
  name: z.string().optional(),
  url: z.string().url().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

// --- Schemas de Input ---

// Schema Base (campos comuns a create e update)
export const rawBaseDespesaSchema = z.object({
  description: z.string().trim().min(2, { message: 'A descrição deve ter pelo menos 2 caracteres' }),
  value: z.number().positive({ message: 'O valor deve ser positivo' }),
  // Aceita ISO String ou Date
  date: z.string().datetime({ message: "Data inválida (ISO 8601)" }).or(z.date()),
  dueDate: z.string().datetime({ message: "Data de vencimento inválida (ISO 8601)" }).or(z.date()),
  category: despesaCategorySchema,
  empreendimento: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const baseDespesaSchema = rawBaseDespesaSchema.refine(data => {
    try {
        const dateObj = new Date(data.date);
        const dueDateObj = new Date(data.dueDate);
        return !isNaN(dateObj.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj >= dateObj;
    } catch { return false; }
}, {
    message: "A data de vencimento não pode ser anterior à data da despesa.",
    path: ["dueDate"],
});

export const createDespesaSchema = rawBaseDespesaSchema.extend({
  status: z.enum(['Pago', 'Pendente', 'A vencer'], {
    errorMap: () => ({ message: "Status para criação deve ser 'Pago', 'Pendente' ou 'A vencer'" })
  }),
  // Anexos são tratados separadamente
}).refine(data => {
    try {
        const dateObj = new Date(data.date);
        const dueDateObj = new Date(data.dueDate);
        return !isNaN(dateObj.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj >= dateObj;
    } catch { return false; }
}, {
    message: "A data de vencimento não pode ser anterior à data da despesa.",
    path: ["dueDate"],
});
  // Anexos são tratados separadamente

export type CreateDespesaInput = z.infer<typeof createDespesaSchema>;

// Schema para ATUALIZAR despesa
export const updateDespesaSchema = rawBaseDespesaSchema.extend({
    status: despesaStatusSchema.optional(), // Permite todos os status na atualização
    // Handle attachments update (e.g., providing a new list or null to clear)
    attachments: z.array(attachmentSchema).optional().nullable(),
  })
  .partial(); // Torna campos do base e extend opcionais
export type UpdateDespesaInput = z.infer<typeof updateDespesaSchema>;

// Schema para REVISAR despesa
export const reviewDespesaSchema = z.object({
  approvalStatus: z.enum(['Aprovado', 'Rejeitado']),
  notes: z.string().optional(),
});
export type ReviewDespesaInput = z.infer<typeof reviewDespesaSchema>;

// --- Schemas de Output ---

// Schema para resposta de despesa individual
export const despesaResponseSchema = z.object({
  _id: z.string(),
  description: z.string(),
  value: z.number(),
  date: z.string().datetime(),
  dueDate: z.string().datetime(),
  status: despesaStatusSchema,
  empreendimento: z.object({
    _id: z.string(),
    name: z.string(),
  }).optional(),
  category: despesaCategorySchema,
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(attachmentSchema).optional(),
  createdBy: z.object({
    _id: z.string(),
    name: z.string(),
  }).optional(),
  approvalStatus: despesaApprovalStatusSchema,
  reviewedBy: z.object({
    _id: z.string(),
    name: z.string(),
  }).optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DespesaResponse = z.infer<typeof despesaResponseSchema>;

// Schema para filtros da lista de despesas
export const despesaFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(15),
  empreendimento: z.string().refine((val) => val === 'todos' || mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
  status: z.array(despesaStatusSchema).optional(),
  category: despesaCategorySchema.optional(),
  approvalStatus: despesaApprovalStatusSchema.optional(),
  search: z.string().optional(),
  startDate: z.string().datetime({ message: "Data inicial inválida (ISO 8601)" }).optional(),
  endDate: z.string().datetime({ message: "Data final inválida (ISO 8601)" }).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
export type DespesaFilterInput = z.infer<typeof despesaFilterSchema>;

// Schema para resposta da lista de despesas
export const despesaListResponseSchema = z.object({
    despesas: z.array(despesaResponseSchema),
    pagination: z.object({
        total: z.number().int().min(0),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().min(0),
        hasMore: z.boolean(),
    })
});
export type DespesaListResponse = z.infer<typeof despesaListResponseSchema>;

// Schema para resumo de despesas
export const despesaSummarySchema = z.object({
  totalValue: z.number(),
  totalCount: z.number().int().min(0),
  paidValue: z.number(), // Renomeado para clareza
  dueValue: z.number(),   // Renomeado para clareza
  // Removidos campos que não eram calculados de forma consistente
});
export type DespesaSummaryOutput = z.infer<typeof despesaSummarySchema>;

// Schema para item de despesa pendente
export const pendingApprovalItemSchema = z.object({
    id: z.string(),
    description: z.string(),
    empreendimentoName: z.string(),
    value: z.number(),
    createdAt: z.string().datetime(),
});
// Schema para resposta da lista de despesas pendentes
export const pendingApprovalsResponseSchema = z.object({
    items: z.array(pendingApprovalItemSchema),
    pagination: z.object({
        total: z.number().int().min(0),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().min(0),
        hasMore: z.boolean(),
    })
});
export type PendingApprovalsResponse = z.infer<typeof pendingApprovalsResponseSchema>;

// Schema para item de próxima despesa
export const upcomingExpenseItemSchema = z.object({
    id: z.string(),
    description: z.string(),
    dueDate: z.string().datetime(),
    value: z.number(),
});
// Schema para resposta da lista de próximas despesas
export const upcomingExpensesResponseSchema = z.object({
    items: z.array(upcomingExpenseItemSchema),
    // Adicionar paginação se necessário
});
export type UpcomingExpensesResponse = z.infer<typeof upcomingExpensesResponseSchema>;

// Schema para item de comparação de despesas
export const despesaComparisonItemSchema = z.object({
    category: z.string(),
    totalValue: z.number(),
    count: z.number().int().min(0),
});
export const despesaComparisonResponseSchema = z.array(despesaComparisonItemSchema);
export type DespesaComparisonResponse = z.infer<typeof despesaComparisonResponseSchema>;

// Schema para item de resumo mensal
export const monthlySummaryItemSchema = z.object({
    nome: z.string(), // e.g., "Jan/24"
    valor: z.number(),
    // count: z.number().int().min(0), // Opcional
});
export const monthlySummaryResponseSchema = z.array(monthlySummaryItemSchema);
export type MonthlySummaryResponse = z.infer<typeof monthlySummaryResponseSchema>;