import { z } from 'zod';
import { notificationPreferencesSchema, userPreferencesSchema } from './auth'; // Reutiliza schemas de auth

/**
 * Schemas para validação de dados de configurações (tRPC)
 */

// --- Profile Settings ---
// Input para atualizar perfil
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  // Assume que a URL do avatar vem de um upload separado ou é passada diretamente
  avatarUrl: z.string().url("URL do avatar inválida").optional().nullable(), // Permite null para remover
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Resposta ao buscar perfil
export const getProfileSettingsResponseSchema = z.object({
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().url().optional().nullable(),
});
export type GetProfileSettingsResponse = z.infer<typeof getProfileSettingsResponseSchema>;

// --- Password Settings ---
// Input para alterar senha do próprio usuário
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// --- Company Settings ---
// Input para atualizar configurações da empresa
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

// Resposta ao buscar configurações da empresa
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


// --- Notification Settings ---
// Input usa o schema de auth, mas força todos os campos a serem enviados
export const updateNotificationSettingsSchema = notificationPreferencesSchema.required();
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;

// Resposta usa o mesmo schema
export const getNotificationSettingsResponseSchema = notificationPreferencesSchema;
export type GetNotificationSettingsResponse = z.infer<typeof getNotificationSettingsResponseSchema>;


// --- API Key Settings ---
// Input para atualizar chaves
export const updateApiKeysSchema = z.object({
  googleApiKey: z.string().optional().nullable(), // JSON string
  awsApiKey: z.string().optional().nullable(),    // Access Key ID
  awsSecretKey: z.string().optional().nullable(), // Secret Access Key
});
export type UpdateApiKeysInput = z.infer<typeof updateApiKeysSchema>;

// Resposta indica apenas se as chaves estão configuradas
export const getApiKeysResponseSchema = z.object({
  googleConfigured: z.boolean(),
  awsConfigured: z.boolean(),
});
export type GetApiKeysResponse = z.infer<typeof getApiKeysResponseSchema>;


// --- API Key Management (Placeholders) ---
export const createApiKeySchema = z.object({
    name: z.string().trim().min(3, "Nome da chave API é obrigatório"),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
    id: z.string().min(1, "ID da chave API é obrigatório"),
});
export type RevokeApiKeyInput = z.infer<typeof revokeApiKeySchema>;