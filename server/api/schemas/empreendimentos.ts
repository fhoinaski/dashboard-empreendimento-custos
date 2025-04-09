// server/api/schemas/empreendimentos.ts
import { z } from 'zod';
import mongoose from 'mongoose';
import { isValid } from 'date-fns'; // Importar isValid

/**
 * Schemas para validação de dados de empreendimentos (tRPC)
 */

// --- Enums ---
export const empreendimentoTypeSchema = z.enum(['Residencial', 'Comercial', 'Misto', 'Industrial'], {
    errorMap: () => ({ message: "Tipo inválido" })
});
export type EmpreendimentoType = z.infer<typeof empreendimentoTypeSchema>;

export const empreendimentoStatusSchema = z.enum(['Planejamento', 'Em andamento', 'Concluído'], {
    errorMap: () => ({ message: "Status inválido" })
});
export type EmpreendimentoStatus = z.infer<typeof empreendimentoStatusSchema>;

// --- Schemas de Input ---

// Campos Base (incluindo 'image' opcional)
const baseEmpreendimentoFields = {
    name: z.string().trim().min(2, { message: 'O nome deve ter pelo menos 2 caracteres' }),
    address: z.string().trim().min(5, { message: 'O endereço deve ter pelo menos 5 caracteres' }),
    type: empreendimentoTypeSchema,
    status: empreendimentoStatusSchema,
    totalUnits: z.coerce.number({ invalid_type_error: "Total de unidades deve ser um número" }).int().min(0, { message: 'Total de unidades inválido' }),
    soldUnits: z.coerce.number({ invalid_type_error: "Unidades vendidas deve ser um número" }).int().min(0, { message: 'Unidades vendidas inválido' }),
    // Aceita string ISO ou Date no input
    startDate: z.string().datetime({ message: "Data inicial inválida (ISO 8601)" }).or(z.date()),
    endDate: z.string().datetime({ message: "Data de conclusão inválida (ISO 8601)" }).or(z.date()),
    description: z.string().optional().nullable(),
    responsiblePerson: z.string().trim().min(1, { message: "Responsável é obrigatório" }),
    contactEmail: z.string().email({ message: 'Email de contato inválido' }),
    contactPhone: z.string().min(10, { message: "Telefone de contato inválido (mínimo 10 dígitos com DDD)" }),
    image: z.string().url("URL da imagem inválida").optional().nullable(),
};

// Schema base COM refine (usado para criação onde os campos são obrigatórios)
const baseEmpreendimentoSchemaWithRefine = z.object(baseEmpreendimentoFields)
.refine(data => data.soldUnits <= data.totalUnits, {
    message: "Unidades vendidas não podem exceder o total.",
    path: ["soldUnits"],
}).refine(data => {
    try {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return isValid(start) && isValid(end) && end >= start;
    } catch { return false; }
}, {
    message: "Data de conclusão não pode ser anterior à data de início.",
    path: ["endDate"],
});

// Schema para criação (base com refine)
export const createEmpreendimentoSchema = baseEmpreendimentoSchemaWithRefine;
export type CreateEmpreendimentoInput = z.infer<typeof createEmpreendimentoSchema>;

// Schema para atualização de empreendimento
// 1. Começa com o objeto base SEM refine
// 2. Aplica .partial() PRIMEIRO
// 3. Aplica os .refine() DEPOIS, ajustando a lógica para campos opcionais
export const updateEmpreendimentoSchema = z.object(baseEmpreendimentoFields) // Usa o objeto base SEM refine inicial
    .partial() // Torna TODOS os campos opcionais PRIMEIRO
    .refine(data => { // Refine 1 (ajustado para partial)
        // Só valida se ambos os campos estiverem presentes no update
        if (typeof data.soldUnits === 'number' && typeof data.totalUnits === 'number') {
             return data.soldUnits <= data.totalUnits;
        }
        return true; // Passa se um ou ambos estiverem ausentes
     }, {
        message: "Unidades vendidas não podem exceder o total.",
        path: ["soldUnits"], // O erro ainda é associado a soldUnits
    })
    .refine(data => { // Refine 2 (ajustado para partial)
        // Só valida se ambas as datas estiverem presentes no update
        if (data.startDate && data.endDate) {
            try {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                if (!isValid(start) || !isValid(end)) return false; // Verifica validade
                return end >= start;
            } catch { return false; }
        }
        return true; // Passa se uma ou ambas estiverem ausentes
    }, {
        message: "Data de conclusão não pode ser anterior à data de início.",
        path: ["endDate"], // O erro ainda é associado a endDate
    });
export type UpdateEmpreendimentoInput = z.infer<typeof updateEmpreendimentoSchema>;

// --- Schemas de Output ---
export const empreendimentoResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  address: z.string(),
  type: empreendimentoTypeSchema,
  status: empreendimentoStatusSchema,
  totalUnits: z.number().int().min(0),
  soldUnits: z.number().int().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  description: z.string().optional().nullable(),
  responsiblePerson: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string(),
  image: z.string().url().optional().nullable(),
  folderId: z.string().optional().nullable(),
  sheetId: z.string().optional().nullable(),
  createdBy: z.object({
    _id: z.string(),
    name: z.string(),
  }).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pendingExpenses: z.number().int().min(0).optional(),
  totalExpenses: z.number().optional(),
});
export type EmpreendimentoResponse = z.infer<typeof empreendimentoResponseSchema>;

// --- Schemas de Filtro e Lista ---
export const empreendimentoFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  searchTerm: z.string().optional(),
  status: empreendimentoStatusSchema.or(z.literal('todos')).optional(),
  type: empreendimentoTypeSchema.or(z.literal('todos')).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
export type EmpreendimentoFilterInput = z.infer<typeof empreendimentoFilterSchema>;

export const empreendimentoListResponseSchema = z.object({
    empreendimentos: z.array(empreendimentoResponseSchema),
    pagination: z.object({
        total: z.number().int().min(0),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().min(0),
        hasMore: z.boolean(),
    })
});
export type EmpreendimentoListResponse = z.infer<typeof empreendimentoListResponseSchema>;

export const deleteEmpreendimentoSchema = z.object({
  id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID de empreendimento inválido' }),
});
export type DeleteEmpreendimentoInput = z.infer<typeof deleteEmpreendimentoSchema>;