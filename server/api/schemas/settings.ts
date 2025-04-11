// FILE: server/api/schemas/settings.ts (Modificado)
// ============================================================
import { z } from 'zod';
import { notificationPreferencesSchema, userPreferencesSchema } from './auth'; // Reutiliza schemas de auth

// --- Schemas de Profile, Password, Company (SEM ALTERAÇÕES SIGNIFICATIVAS AQUI) ---
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  avatarUrl: z.string().url("URL do avatar inválida").optional().nullable(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const getProfileSettingsResponseSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().url().optional().nullable(),
});
export type GetProfileSettingsResponse = z.infer<typeof getProfileSettingsResponseSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateCompanySettingsSchema = z.object({
  companyName: z.string().trim().optional().nullable(),
  cnpj: z.string().trim()
    .refine((val) => !val || /^\d{14}$/.test(val.replace(/\D/g,'')), { message: "CNPJ inválido (deve conter 14 dígitos)"})
    .optional().nullable(),
  companyAddress: z.string().trim().optional().nullable(),
  companyPhone: z.string().trim().optional().nullable(),
  companyEmail: z.string().email("Email da empresa inválido").optional().nullable(),
  logoUrl: z.string().url("URL do logo inválida").optional().nullable(),
});
export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;

export const getCompanySettingsResponseSchema = z.object({
  _id: z.string(),
  companyName: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  companyEmail: z.string().email().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  updatedAt: z.string().datetime(),
});
export type GetCompanySettingsResponse = z.infer<typeof getCompanySettingsResponseSchema>;

// --- Schemas de Notification (SEM ALTERAÇÕES) ---
export const updateNotificationSettingsSchema = notificationPreferencesSchema.required();
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;

export const getNotificationSettingsResponseSchema = notificationPreferencesSchema;
export type GetNotificationSettingsResponse = z.infer<typeof getNotificationSettingsResponseSchema>;

// --- Schemas de API Key Globais (Mantidos, se necessário) ---
export const updateApiKeysSchema = z.object({
  googleApiKey: z.string().optional().nullable(), // JSON string (ou chave API geral)
  awsApiKey: z.string().optional().nullable(),
  awsSecretKey: z.string().optional().nullable(),
});
export type UpdateApiKeysInput = z.infer<typeof updateApiKeysSchema>;

export const getApiKeysResponseSchema = z.object({
  googleConfigured: z.boolean(), // Configuração global
  awsConfigured: z.boolean(),
});
export type GetApiKeysResponse = z.infer<typeof getApiKeysResponseSchema>;

// --- NOVOS SCHEMAS PARA INTEGRAÇÃO GOOGLE POR TENANT ---

// Schema para buscar as configurações de integração do tenant
export const getTenantIntegrationSettingsResponseSchema = z.object({
    googleDriveEnabled: z.boolean(),
    googleSheetsEnabled: z.boolean(),
    googleServiceAccountConfigured: z.boolean(), // Indica se o JSON está salvo (sem retornar o JSON)
});
export type GetTenantIntegrationSettingsResponse = z.infer<typeof getTenantIntegrationSettingsResponseSchema>;

// Schema para atualizar as configurações de integração do tenant
export const updateTenantIntegrationSettingsSchema = z.object({
    googleDriveEnabled: z.boolean(),
    googleSheetsEnabled: z.boolean(),
    // O JSON é opcional. Se `null`, remove a chave existente. Se `undefined`, não altera.
    googleServiceAccountJson: z.string().optional().nullable(),
}).refine(data => {
    // Validação extra: Se o JSON for fornecido, deve ser um JSON válido
    if (typeof data.googleServiceAccountJson === 'string' && data.googleServiceAccountJson.trim() !== '') {
        try {
            const parsed = JSON.parse(data.googleServiceAccountJson);
            // Validações básicas da estrutura do JSON
            return typeof parsed === 'object' && parsed !== null && parsed.client_email && parsed.private_key;
        } catch (e) {
            return false;
        }
    }
    return true; // Passa se for null, undefined ou string vazia (que será tratada como null no backend)
}, {
    message: "O conteúdo fornecido não é um JSON válido.",
    path: ["googleServiceAccountJson"], // Associa o erro ao campo JSON
});
export type UpdateTenantIntegrationSettingsInput = z.infer<typeof updateTenantIntegrationSettingsSchema>;

// --- Schemas de Gerenciamento de Chave API (Mantidos, se necessário) ---
export const createApiKeySchema = z.object({
    name: z.string().trim().min(3, "Nome da chave API é obrigatório"),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
    id: z.string().min(1, "ID da chave API é obrigatório"),
});
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;
// ============================================================
// FIM DO ARQUIVO MODIFICADO: server/api/schemas/settings.ts
// ============================================================