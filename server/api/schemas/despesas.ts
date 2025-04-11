// ============================================================
// FILE: server/api/schemas/despesas.ts
// ============================================================
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
  date: z.string().datetime({ message: "Data inválida (ISO 8601)" }).or(z.date()),
  dueDate: z.string().datetime({ message: "Data de vencimento inválida (ISO 8601)" }).or(z.date()),
  category: despesaCategorySchema,
  empreendimento: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  paymentMethod: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const baseDespesaSchema = rawBaseDespesaSchema.refine(data => {
  try {
    const dateObj = new Date(data.date);
    const dueDateObj = new Date(data.dueDate);
    return !isNaN(dateObj.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj >= dateObj;
  } catch {
    return false;
  }
}, {
  message: "A data de vencimento não pode ser anterior à data da despesa.",
  path: ["dueDate"],
});

// Schema para Criar Despesa
export const createDespesaSchema = rawBaseDespesaSchema.extend({
  status: z.enum(['Pago', 'Pendente', 'A vencer'], {
    errorMap: () => ({ message: "Status para criação deve ser 'Pago', 'Pendente' ou 'A vencer'" })
  }),
}).refine(data => {
  try {
    const dateObj = new Date(data.date);
    const dueDateObj = new Date(data.dueDate);
    return !isNaN(dateObj.getTime()) && !isNaN(dueDateObj.getTime()) && dueDateObj >= dateObj;
  } catch {
    return false;
  }
}, {
  message: "A data de vencimento não pode ser anterior à data da despesa.",
  path: ["dueDate"],
});
export type CreateDespesaInput = z.infer<typeof createDespesaSchema>;

// Schema para Atualizar Despesa
export const updateDespesaSchema = rawBaseDespesaSchema.extend({
  status: despesaStatusSchema.optional(),
  attachments: z.array(attachmentSchema).optional().nullable(),
}).partial();
export type UpdateDespesaInput = z.infer<typeof updateDespesaSchema>;

// Schema para Revisar Despesa
export const reviewDespesaSchema = z.object({
  approvalStatus: z.enum(['Aprovado', 'Rejeitado']),
  notes: z.string().optional(),
});
export type ReviewDespesaInput = z.infer<typeof reviewDespesaSchema>;

// Schema para Filtros da Lista de Despesas (movido para cima para evitar TS2304)
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

// --- Schemas de Output ---

// Schema para Resposta de Despesa Individual
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

// Schema para Resposta da Lista de Despesas
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

// Schema para Resumo de Despesas
export const despesaSummarySchema = z.object({
  totalValue: z.number(),
  totalCount: z.number().int().min(0),
  paidValue: z.number(),
  dueValue: z.number(),
});
export type DespesaSummaryOutput = z.infer<typeof despesaSummarySchema>;

// Schema para Item de Despesa Pendente
export const pendingApprovalItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  empreendimentoName: z.string(),
  value: z.number(),
  createdAt: z.string().datetime(),
});

// Schema para Resposta da Lista de Despesas Pendentes
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

// Schema para Item de Próxima Despesa
export const upcomingExpenseItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  dueDate: z.string().datetime(),
  value: z.number(),
});

// Schema para Resposta da Lista de Próximas Despesas
export const upcomingExpensesResponseSchema = z.object({
  items: z.array(upcomingExpenseItemSchema),
});
export type UpcomingExpensesResponse = z.infer<typeof upcomingExpensesResponseSchema>;

// Schema para Item de Comparação de Despesas
export const despesaComparisonItemSchema = z.object({
  category: z.string(),
  totalValue: z.number(),
  count: z.number().int().min(0),
});
export const despesaComparisonResponseSchema = z.array(despesaComparisonItemSchema);
export type DespesaComparisonResponse = z.infer<typeof despesaComparisonResponseSchema>;

// Schema para Item de Resumo Mensal
export const monthlySummaryItemSchema = z.object({
  nome: z.string(),
  valor: z.number(),
});
export const monthlySummaryResponseSchema = z.array(monthlySummaryItemSchema);
export type MonthlySummaryResponse = z.infer<typeof monthlySummaryResponseSchema>;

// --- Schemas de Filtro e Input Adicionais ---

// Filtro Base para Relatórios
export const relatorioBaseFilterSchema = z.object({
  startDate: z.string().datetime({ message: "Data inicial inválida (ISO 8601)" }),
  endDate: z.string().datetime({ message: "Data final inválida (ISO 8601)" }),
  empreendimentoId: z.string().refine((val) => val === 'todos' || mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
});

// Inputs Específicos
export const getComparisonByCategoryInputSchema = relatorioBaseFilterSchema;
export const getMonthlySummaryInputSchema = relatorioBaseFilterSchema;

export const listPendingReviewInputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  page: z.number().int().min(1).default(1),
});

export const getGeneralSummaryInputSchema = despesaFilterSchema.omit({
  page: true,
  limit: true,
  sortBy: true,
  sortOrder: true
});

export const listUpcomingDueInputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  empreendimentoId: z.string().refine((val) => val === 'todos' || mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
});

// --- Schema para Resposta da Mutação de Update ---
export const updateDespesaResponseSchema = z.object({
  id: z.string(),
  description: z.string(),
});
export type UpdateDespesaResponse = z.infer<typeof updateDespesaResponseSchema>;

// ============================================================
// END OF FILE: server/api/schemas/despesas.ts
// ============================================================