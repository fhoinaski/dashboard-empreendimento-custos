// lib/trpc/types.ts
import { z } from 'zod';
import { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/api/root';

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
  date: z.date().or(z.string().refine(s => !isNaN(Date.parse(s)), "Data inválida")), // Aceita string ISO ou Date
  dueDate: z.date().or(z.string().refine(s => !isNaN(Date.parse(s)), "Data inválida")), // Aceita string ISO ou Date
  category: DespesaCategorySchema,
  empreendimento: z.string().min(1, 'Empreendimento é obrigatório'),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.number(),
    fileId: z.string().optional()
  })).optional()
});

// Schema específico para CRIAR despesa (não permite status 'Rejeitado')
export const CreateDespesaFormSchema = BaseDespesaFormSchema.extend({
  status: z.enum(['Pago', 'Pendente', 'A vencer'], {
    errorMap: () => ({ message: "Status para criação deve ser 'Pago', 'Pendente' ou 'A vencer'" })
  }),
});
export type CreateDespesaFormInput = z.infer<typeof CreateDespesaFormSchema>;

// Schema específico para ATUALIZAR despesa (permite 'Rejeitado', campos opcionais)
export const UpdateDespesaFormSchema = BaseDespesaFormSchema.extend({
  status: DespesaStatusSchema.optional(), // Permite 'Rejeitado' na atualização
}).partial(); // Torna todos os campos opcionais
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
  status?: ('Pago' | 'Pendente' | 'A vencer' | 'Rejeitado')[]; // Corrigido para usar valores específicos
  approvalStatus?: DespesaApprovalStatus;
  category?: DespesaCategory;
  empreendimento?: string;
  startDate?: string;
  endDate?: string;
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

export const UserRoleSchema = z.enum(['Admin', 'User', 'Manager']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export interface Session { // Mantido para compatibilidade com auth-context se ainda usado
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: UserRole;
    assignedEmpreendimentos?: string[];
  };
  expires: string;
}

export interface Notification { // Mantido para compatibilidade com notification-context se ainda usado
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  link?: string;
  createdAt: string;
}