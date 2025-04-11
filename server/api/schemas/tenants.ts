// ============================================================
// REFACTORED FILE: server/api/schemas/tenants.ts (Fix TS2304)
// ============================================================
import { z } from 'zod';
import mongoose from 'mongoose';

// --- Enums ---
// Definição CORRETA do schema Zod
export const tenantStatusEnumSchema = z.enum(['active', 'pending', 'suspended', 'cancelled'], { // Renomeado para 'cancelled'
    errorMap: () => ({ message: "Status de tenant inválido" })
});
// Definição CORRETA do tipo TypeScript derivado do schema
export type TenantStatus = z.infer<typeof tenantStatusEnumSchema>;

// --- Schemas de Input ---

// Schema para filtros de listagem de tenants (Super Admin)
export const listTenantsFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(15),
  // CORREÇÃO: Usar o schema Zod aqui
  status: tenantStatusEnumSchema.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'slug', 'status', 'createdAt', '_id']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
export type ListTenantsFilterInput = z.infer<typeof listTenantsFilterSchema>;

// Schema para atualização de status de tenant (Super Admin)
export const updateTenantStatusInputSchema = z.object({
  tenantId: z.string().refine(mongoose.isValidObjectId, { message: "ID de tenant inválido" }),
  // CORREÇÃO: Usar o schema Zod aqui
  status: tenantStatusEnumSchema
});
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusInputSchema>;

// Schema para criação de tenant com admin (Super Admin)
export const createTenantWithAdminInputSchema = z.object({
    tenantName: z.string().trim().min(3, { message: "Nome do Tenant muito curto" }),
    adminName: z.string().trim().min(2, { message: "Nome do Admin muito curto" }),
    adminEmail: z.string().email({ message: "Email do Admin inválido" }),
    adminPassword: z.string().min(8, { message: "Senha do Admin deve ter no mínimo 8 caracteres" }),
    plan: z.enum(['free', 'basic', 'pro', 'enterprise']).default('free'),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Slug inválido (letras minúsculas, números, hífens)" }).optional(),
});
export type CreateTenantWithAdminInput = z.infer<typeof createTenantWithAdminInputSchema>;

// --- Schemas de Output ---

// Schema para os dados de configuração de integração retornados
export const integrationSettingsStatusSchema = z.object({
    googleDriveEnabled: z.boolean().default(false),
    googleSheetsEnabled: z.boolean().default(false),
    googleServiceAccountConfigured: z.boolean().default(false),
});
export type IntegrationSettingsStatus = z.infer<typeof integrationSettingsStatusSchema>;

// Schema para informações do admin principal do tenant
export const tenantAdminInfoSchema = z.object({
    _id: z.string(),
    email: z.string().email(),
    name: z.string(),
}).optional().nullable(); // Admin pode não ser encontrado

// Schema para resposta de um Tenant na lista (inclui info extra)
export const tenantListItemSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  // CORREÇÃO: Usar o schema Zod aqui
  status: tenantStatusEnumSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  admin: tenantAdminInfoSchema,
  userCount: z.number().int().nonnegative(),
  integrationSettings: integrationSettingsStatusSchema,
});
export type TenantListItem = z.infer<typeof tenantListItemSchema>;

// Schema para resposta da listagem de Tenants (Super Admin)
export const tenantListResponseSchema = z.object({
    tenants: z.array(tenantListItemSchema),
    pagination: z.object({
        total: z.number().int().nonnegative(),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().nonnegative(),
        hasMore: z.boolean()
    })
});
export type TenantListResponse = z.infer<typeof tenantListResponseSchema>;

// Schema de resposta simples para mutações
export const simpleSuccessResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional(),
});
export type SimpleSuccessResponse = z.infer<typeof simpleSuccessResponseSchema>;

// Schema de resposta para criação de tenant
export const createTenantResponseSchema = simpleSuccessResponseSchema.extend({
    tenantId: z.string().optional(),
    adminUserId: z.string().optional(),
});
export type CreateTenantResponse = z.infer<typeof createTenantResponseSchema>;

// ============================================================
// END OF REFACTORED FILE
// ============================================================