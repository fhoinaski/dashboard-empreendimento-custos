// FILE: lib/trpc/types.ts
// STATUS: CORRECTED (Added .nullable() to BaseDespesaFormSchema)

import { z } from 'zod';
import { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/api/root';
import mongoose from 'mongoose'; // Import mongoose for ObjectId validation
import { isValid } from 'date-fns'; // Import isValid for date checks


// Inferir tipos de saída dos procedimentos tRPC
export type RouterOutput = inferRouterOutputs<AppRouter>;

// Tipos específicos para cada domínio
export type EmpreendimentoOutput = RouterOutput['empreendimentos']['getById'];
export type EmpreendimentoListOutput = RouterOutput['empreendimentos']['getAll'];
export type DespesaOutput = RouterOutput['despesas']['getById'];
export type DespesaListOutput = RouterOutput['despesas']['getAll'];

// Interface para anexos
export interface Attachment {
  _id?: string;
  fileId?: string;
  name?: string;
  url?: string;
  type?: string;
  size?: number;
}

// Interface para despesa do cliente
export interface ClientDespesa {
  _id: string;
  description: string;
  value: number;
  status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado';
  date: string; // ISO string
  dueDate: string; // ISO string
  category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
  paymentMethod?: string | null;
  notes?: string | null;
  empreendimento?: { _id: string; name: string } | null;
  createdBy?: { _id: string; name: string } | null;
  reviewedBy?: { _id: string; name: string } | null;
  reviewedAt?: string | null; // ISO string
  attachments?: Attachment[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  approvalStatus?: 'Pendente' | 'Aprovado' | 'Rejeitado';
}

// Schemas Zod para validação
export const DespesaStatusSchema = z.enum(['Pago', 'Pendente', 'A vencer', 'Rejeitado']);
export type DespesaStatus = z.infer<typeof DespesaStatusSchema>;

export const DespesaApprovalStatusSchema = z.enum(['Pendente', 'Aprovado', 'Rejeitado']);
export type DespesaApprovalStatus = z.infer<typeof DespesaApprovalStatusSchema>;

export const DespesaCategorySchema = z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros']);
export type DespesaCategory = z.infer<typeof DespesaCategorySchema>;

// Schemas Zod para validação de empreendimentos
export const EmpreendimentoStatusSchema = z.enum(['Planejamento', 'Em andamento', 'Concluído']);
export type EmpreendimentoStatus = z.infer<typeof EmpreendimentoStatusSchema>;

export const EmpreendimentoTypeSchema = z.enum(['Residencial', 'Comercial', 'Misto', 'Industrial']);
export type EmpreendimentoType = z.infer<typeof EmpreendimentoTypeSchema>;

// Schemas para formulários
export const BaseDespesaFormSchema = z.object({ // Schema base
  description: z.string().min(3, 'Descrição deve ter pelo menos 3 caracteres'),
  value: z.number().positive('Valor deve ser positivo'),
  // Allow Date or ISO string for flexibility, refine checks validity later
  date: z.date().or(z.string().datetime({ message: "Formato de data inválido (ISO)" })),
  dueDate: z.date().or(z.string().datetime({ message: "Formato de data de vencimento inválido (ISO)" })),
  category: DespesaCategorySchema,
  empreendimento: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  // *** FIX: Add .nullable() here to allow null from the form ***
  paymentMethod: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  // *** END FIX ***
  // attachments removed from base schema for create/update clarity
});

// Schema específico para CRIAR despesa
export const CreateDespesaFormSchema = BaseDespesaFormSchema.extend({
  status: z.enum(['Pago', 'Pendente', 'A vencer'], {
    errorMap: () => ({ message: "Status para criação deve ser 'Pago', 'Pendente' ou 'A vencer'" })
  }),
}).refine(data => { // Add refine check for dates here
    try {
        const dateObj = data.date instanceof Date ? data.date : new Date(data.date);
        const dueDateObj = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
        return isValid(dateObj) && isValid(dueDateObj) && dueDateObj >= dateObj;
    } catch { return false; }
}, {
    message: "A data de vencimento não pode ser anterior à data da despesa.",
    path: ["dueDate"],
});
export type CreateDespesaInput = z.infer<typeof CreateDespesaFormSchema>;


// Schema específico para ATUALIZAR despesa
export const UpdateDespesaFormSchema = BaseDespesaFormSchema
  .partial() // Make base fields optional for update
  .extend({
    status: DespesaStatusSchema.optional(), // Allow all statuses in update
    // Allow sending null/undefined/array for attachments during update
    attachments: z.array(z.object({
        _id: z.string().optional(),
        fileId: z.string().optional(),
        name: z.string().optional(),
        url: z.string().url().optional(),
    })).optional().nullable(),
}).refine(data => { // Refine for update: only check dates if both are provided
    if (data.date && data.dueDate) {
        try {
            const start = data.date instanceof Date ? data.date : new Date(data.date);
            const end = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
            if (!isValid(start) || !isValid(end)) return false; // Check validity
            return end >= start;
        } catch { return false; }
    }
    return true; // Pass if one or both dates are missing in the update data
}, {
    message: "Data de conclusão não pode ser anterior à data de início.",
    path: ["dueDate"], // Apply error to dueDate field
});
export type UpdateDespesaFormInput = z.infer<typeof UpdateDespesaFormSchema>;


// Interface para documento do cliente
export interface ClientDocument {
  _id: string;
  name: string;
  type: string;
  category?: string;
  fileId: string;
  url?: string | null;
  empreendimento: { _id: string; name: string };
  createdBy?: { _id: string; name: string } | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Interface para empreendimento do cliente
export interface ClientEmpreendimento {
  _id: string;
  name: string;
  address: string;
  type: 'Residencial' | 'Comercial' | 'Misto' | 'Industrial';
  status: 'Planejamento' | 'Em andamento' | 'Concluído';
  totalUnits: number;
  soldUnits: number;
  startDate: string; // ISO string
  endDate: string; // ISO string
  description?: string | null;
  responsiblePerson: string;
  contactEmail: string;
  contactPhone: string;
  image?: string | null;
  folderId?: string | null;
  sheetId?: string | null;
  createdBy?: { _id: string; name: string } | null;
  pendingExpenses?: number;
  totalExpenses?: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Tipos para parâmetros de consulta
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Interface para informações de paginação retornadas pelas consultas
export interface PaginationInfo {
  total: number;
  limit: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

export interface DespesaFilterParams extends PaginationParams {
  status?: ('Pago' | 'Pendente' | 'A vencer' | 'Rejeitado')[];
  approvalStatus?: DespesaApprovalStatus;
  category?: DespesaCategory;
  empreendimento?: string; // Can be 'todos' or ObjectId string
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmpreendimentoFilterParams extends PaginationParams {
  searchTerm?: string;
  status?: EmpreendimentoStatus;
  type?: EmpreendimentoType;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ... (outros tipos permanecem iguais) ...

export const UserRoleSchema = z.enum(['admin', 'manager', 'user']); // Use lowercase
export type UserRole = z.infer<typeof UserRoleSchema>;

// Note: Interfaces 'Session' and 'Notification' might be better defined
// within their respective context files if only used there, or keep them here
// if they are truly shared across the application.

export interface Session {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null; // Typically used by NextAuth for avatar
    role?: UserRole;
    assignedEmpreendimentos?: string[];
    avatarUrl?: string | null; // Add specific field if needed
  };
  expires: string;
}

export interface Notification {
  id: string;
  userId: string; // Or recipientId
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  createdAt: string; // ISO string
}