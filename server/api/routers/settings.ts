// FILE: server/api/routers/settings.ts (Refatorado Completo)
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure, superAdminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    changePasswordSchema,
    createApiKeySchema,
    getApiKeysResponseSchema,
    getCompanySettingsResponseSchema,
    getNotificationSettingsResponseSchema,
    getProfileSettingsResponseSchema,
    getTenantIntegrationSettingsResponseSchema,
    revokeApiKeySchema,
    updateApiKeysSchema,
    updateCompanySettingsSchema,
    updateNotificationSettingsSchema,
    updateProfileSchema,
    updateTenantIntegrationSettingsSchema,
} from '../schemas/settings';
import connectToDatabase from '@/lib/db/mongodb';
import { AppSettings, User } from '@/lib/db/models';
import { compare, hash } from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { decrypt, encrypt } from '@/lib/crypto';

// Interface para tipagem lean do AppSettings
interface AppSettingsLeanResponse {
    _id: string | Types.ObjectId;
    tenantId?: Types.ObjectId | null;
    companyName?: string | null;
    cnpj?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    logoUrl?: string | null;
    updatedAt: Date;
    googleApiKeyEncrypted?: string | null;
    awsApiKeyEncrypted?: string | null;
    awsSecretKeyEncrypted?: string | null;
    googleDriveEnabled?: boolean;
    googleSheetsEnabled?: boolean;
    googleServiceAccountJsonEncrypted?: string | null;
}

export const settingsRouter = router({
    // --- Profile Settings ---
    getProfileSettings: protectedProcedure
        .output(getProfileSettingsResponseSchema)
        .query(async ({ ctx }) => {
            console.log(`[tRPC settings.getProfileSettings] Buscando perfil para usuário: ${ctx.user.id}`);
            await connectToDatabase();
            const user = await User.findById(ctx.user.id)
                .select('name email avatarUrl')
                .lean<{ name: string; email: string; avatarUrl?: string | null } | null>();

            if (!user) {
                console.error(`[tRPC settings.getProfileSettings] Usuário não encontrado: ${ctx.user.id}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            console.log(`[tRPC settings.getProfileSettings] Perfil encontrado para: ${user.email}`);
            return {
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl ?? null,
            };
        }),

    updateProfile: protectedProcedure
        .input(updateProfileSchema)
        .mutation(async ({ input, ctx }) => {
            console.log(`[tRPC settings.updateProfile] Atualizando perfil para usuário: ${ctx.user.id}`, input);
            await connectToDatabase();
            const userId = ctx.user.id;
            const user = await User.findById(userId);

            if (!user) {
                console.error(`[tRPC settings.updateProfile] Usuário não encontrado: ${userId}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            const updateData: { name?: string; avatarUrl?: string | null; updatedAt: Date } = {
                updatedAt: new Date(),
            };

            if (input.name !== undefined && input.name !== user.name) updateData.name = input.name;
            if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;

            if (Object.keys(updateData).length <= 1) {
                console.log('[tRPC settings.updateProfile] Nenhum campo alterado.');
                return {
                    success: true,
                    message: 'Nenhuma alteração detectada no perfil.',
                    user: { name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null },
                };
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updateData },
                { new: true }
            )
                .select('name email avatarUrl')
                .lean<{ name: string; email: string; avatarUrl?: string | null } | null>();

            if (!updatedUser) {
                console.error(`[tRPC settings.updateProfile] Falha ao atualizar usuário: ${userId}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar perfil' });
            }

            console.log('[tRPC settings.updateProfile] Perfil atualizado com sucesso.');
            return {
                success: true,
                message: 'Perfil atualizado com sucesso',
                user: {
                    name: updatedUser.name,
                    email: updatedUser.email,
                    avatarUrl: updatedUser.avatarUrl ?? null,
                },
            };
        }),

    // --- Password Settings ---
    updatePassword: protectedProcedure
        .input(changePasswordSchema)
        .mutation(async ({ input, ctx }) => {
            console.log(`[tRPC settings.updatePassword] Alterando senha para usuário: ${ctx.user.id}`);
            await connectToDatabase();
            const user = await User.findById(ctx.user.id);

            if (!user) {
                console.error(`[tRPC settings.updatePassword] Usuário não encontrado: ${ctx.user.id}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            const isPasswordValid = await compare(input.currentPassword, user.password);
            if (!isPasswordValid) {
                console.warn(`[tRPC settings.updatePassword] Senha atual incorreta para usuário: ${ctx.user.id}`);
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' });
            }

            const hashedPassword = await hash(input.newPassword, 12);
            user.password = hashedPassword;
            user.updatedAt = new Date();
            await user.save();

            console.log(`[tRPC settings.updatePassword] Senha atualizada com sucesso para usuário: ${ctx.user.id}`);
            return { success: true, message: 'Senha atualizada com sucesso' };
        }),

    // --- Company Settings (Super Admin - Configuração Global) ---
    getCompanySettings: superAdminProcedure
        .output(getCompanySettingsResponseSchema)
        .query(async () => {
            console.log('[tRPC settings.getCompanySettings] Buscando configurações globais');
            await connectToDatabase();
            const settings = await AppSettings.findOne({ tenantId: null })
                .lean<AppSettingsLeanResponse | null>();

            const defaultResponse = {
                _id: 'global_settings',
                companyName: null,
                cnpj: null,
                companyAddress: null,
                companyPhone: null,
                companyEmail: null,
                logoUrl: null,
                updatedAt: new Date().toISOString(),
            };

            if (!settings) {
                console.log('[tRPC settings.getCompanySettings] Nenhuma configuração global encontrada, retornando padrão');
                return defaultResponse;
            }

            console.log('[tRPC settings.getCompanySettings] Configurações globais encontradas');
            return {
                _id: settings._id.toString(),
                companyName: settings.companyName ?? null,
                cnpj: settings.cnpj ?? null,
                companyAddress: settings.companyAddress ?? null,
                companyPhone: settings.companyPhone ?? null,
                companyEmail: settings.companyEmail ?? null,
                logoUrl: settings.logoUrl ?? null,
                updatedAt: settings.updatedAt.toISOString(),
            };
        }),

    updateCompanySettings: superAdminProcedure
        .input(updateCompanySettingsSchema)
        .mutation(async ({ input }) => {
            console.log('[tRPC settings.updateCompanySettings] Atualizando configurações globais:', input);
            await connectToDatabase();

            const updateData: Partial<Omit<AppSettingsLeanResponse, '_id' | 'tenantId'>> & { updatedAt: Date } = {
                updatedAt: new Date(),
            };

            for (const [key, value] of Object.entries(input)) {
                if (value !== undefined) {
                    (updateData as any)[key] = value;
                }
            }

            const updatedSettings = await AppSettings.findOneAndUpdate(
                { tenantId: null },
                { $set: updateData },
                { new: true, upsert: true, runValidators: true }
            ).lean<AppSettingsLeanResponse | null>();

            if (!updatedSettings) {
                console.error('[tRPC settings.updateCompanySettings] Falha ao atualizar configurações globais');
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar configurações globais' });
            }

            console.log('[tRPC settings.updateCompanySettings] Configurações globais atualizadas com sucesso');
            return {
                success: true,
                message: 'Configurações globais da empresa atualizadas',
                settings: {
                    _id: updatedSettings._id.toString(),
                    companyName: updatedSettings.companyName ?? null,
                    cnpj: updatedSettings.cnpj ?? null,
                    companyAddress: updatedSettings.companyAddress ?? null,
                    companyPhone: updatedSettings.companyPhone ?? null,
                    companyEmail: updatedSettings.companyEmail ?? null,
                    logoUrl: updatedSettings.logoUrl ?? null,
                    updatedAt: updatedSettings.updatedAt.toISOString(),
                },
            };
        }),

    // --- Notification Settings ---
    getNotificationSettings: protectedProcedure
        .output(getNotificationSettingsResponseSchema)
        .query(async ({ ctx }) => {
            console.log(`[tRPC settings.getNotificationSettings] Buscando preferências para usuário: ${ctx.user.id}`);
            await connectToDatabase();
            const user = await User.findById(ctx.user.id)
                .select('notificationPreferences')
                .lean<{ notificationPreferences?: z.infer<typeof getNotificationSettingsResponseSchema> } | null>();

            if (!user) {
                console.error(`[tRPC settings.getNotificationSettings] Usuário não encontrado: ${ctx.user.id}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            const defaults = {
                emailDespesasVencer: true,
                emailDocumentosNovos: true,
                emailRelatoriosSemanais: false,
                systemDespesasVencer: true,
                systemDocumentosNovos: true,
                systemEventosCalendario: true,
                antecedenciaVencimento: 3,
            };

            const preferences = user.notificationPreferences || defaults;
            console.log(`[tRPC settings.getNotificationSettings] Preferências retornadas para: ${ctx.user.id}`);
            return preferences;
        }),

    updateNotificationSettings: protectedProcedure
        .input(updateNotificationSettingsSchema)
        .mutation(async ({ input, ctx }) => {
            console.log(`[tRPC settings.updateNotificationSettings] Atualizando preferências para usuário: ${ctx.user.id}`);
            await connectToDatabase();

            const updatedUser = await User.findByIdAndUpdate(
                ctx.user.id,
                { $set: { notificationPreferences: input, updatedAt: new Date() } },
                { new: true, runValidators: true }
            )
                .select('notificationPreferences')
                .lean();

            if (!updatedUser) {
                console.error(`[tRPC settings.updateNotificationSettings] Usuário não encontrado: ${ctx.user.id}`);
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
            }

            console.log(`[tRPC settings.updateNotificationSettings] Preferências atualizadas para: ${ctx.user.id}`);
            return {
                success: true,
                message: 'Preferências de notificação atualizadas',
                preferences: updatedUser.notificationPreferences,
            };
        }),

    // --- API Key Settings (Super Admin - Configuração Global) ---
    getApiKeys: superAdminProcedure
        .output(getApiKeysResponseSchema)
        .query(async () => {
            console.log('[tRPC settings.getApiKeys] Verificando status das chaves globais');
            await connectToDatabase();
            const settings = await AppSettings.findOne({ tenantId: null })
                .select('googleApiKeyEncrypted awsApiKeyEncrypted awsSecretKeyEncrypted')
                .lean<AppSettingsLeanResponse | null>();

            const response = {
                googleConfigured: !!settings?.googleApiKeyEncrypted,
                awsConfigured: !!settings?.awsApiKeyEncrypted && !!settings?.awsSecretKeyEncrypted,
            };

            console.log('[tRPC settings.getApiKeys] Status retornado:', response);
            return response;
        }),

    updateApiKeys: superAdminProcedure
        .input(updateApiKeysSchema)
        .mutation(async ({ input }) => {
            console.log('[tRPC settings.updateApiKeys] Atualizando chaves globais');
            await connectToDatabase();

            const updateData: Partial<AppSettingsLeanResponse> & { updatedAt: Date } = {
                updatedAt: new Date(),
            };

            if (input.googleApiKey !== undefined) {
                updateData.googleApiKeyEncrypted = input.googleApiKey ? await encrypt(input.googleApiKey) : null;
            }
            if (input.awsApiKey !== undefined) {
                updateData.awsApiKeyEncrypted = input.awsApiKey ? await encrypt(input.awsApiKey) : null;
            }
            if (input.awsSecretKey !== undefined) {
                updateData.awsSecretKeyEncrypted = input.awsSecretKey ? await encrypt(input.awsSecretKey) : null;
            }

            if (Object.keys(updateData).length <= 1) {
                console.log('[tRPC settings.updateApiKeys] Nenhuma chave fornecida para atualização');
                return { success: true, message: 'Nenhuma chave API fornecida' };
            }

            const updatedSettings = await AppSettings.findOneAndUpdate(
                { tenantId: null },
                { $set: updateData },
                { new: true, upsert: true, runValidators: true }
            );

            if (!updatedSettings) {
                console.error('[tRPC settings.updateApiKeys] Falha ao atualizar chaves globais');
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar chaves globais' });
            }

            console.log('[tRPC settings.updateApiKeys] Chaves globais atualizadas com sucesso');
            return { success: true, message: 'Chaves de API globais atualizadas' };
        }),

    // --- Tenant Integration Settings (Tenant Admin) ---
    getTenantIntegrationSettings: tenantAdminProcedure
        .output(getTenantIntegrationSettingsResponseSchema)
        .query(async ({ ctx }) => {
            const tenantId = new Types.ObjectId(ctx.tenantId!);
            console.log(`[tRPC settings.getTenantIntegrationSettings] Buscando configurações para tenant: ${tenantId}`);
            await connectToDatabase();

            const settings = await AppSettings.findOne({ tenantId })
                .select('googleDriveEnabled googleSheetsEnabled googleServiceAccountJsonEncrypted')
                .lean<AppSettingsLeanResponse | null>();

            const response = {
                googleDriveEnabled: settings?.googleDriveEnabled ?? false,
                googleSheetsEnabled: settings?.googleSheetsEnabled ?? false,
                googleServiceAccountConfigured: !!settings?.googleServiceAccountJsonEncrypted,
            };

            console.log(`[tRPC settings.getTenantIntegrationSettings] Configurações retornadas para tenant: ${tenantId}`);
            return response;
        }),

    updateTenantIntegrationSettings: tenantAdminProcedure
        .input(updateTenantIntegrationSettingsSchema)
        .mutation(async ({ input, ctx }) => {
            const tenantId = new Types.ObjectId(ctx.tenantId!);
            console.log(`[tRPC settings.updateTenantIntegrationSettings] Atualizando configurações para tenant: ${tenantId}`);
            await connectToDatabase();

            const updateData: Partial<AppSettingsLeanResponse> & { updatedAt: Date } = {
                updatedAt: new Date(),
                googleDriveEnabled: input.googleDriveEnabled,
                googleSheetsEnabled: input.googleSheetsEnabled,
            };

            if (input.googleServiceAccountJson === null) {
                updateData.googleServiceAccountJsonEncrypted = null;
            } else if (input.googleServiceAccountJson) {
                updateData.googleServiceAccountJsonEncrypted = await encrypt(input.googleServiceAccountJson);
            }

            const updatedSettings = await AppSettings.findOneAndUpdate(
                { _id: tenantId, tenantId },
                { $set: updateData },
                { upsert: true, new: true, runValidators: true }
            );

            if (!updatedSettings) {
                console.error(`[tRPC settings.updateTenantIntegrationSettings] Falha ao atualizar configurações para tenant: ${tenantId}`);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar configurações de integração' });
            }

            console.log(`[tRPC settings.updateTenantIntegrationSettings] Configurações atualizadas para tenant: ${tenantId}`);
            return { success: true, message: 'Configurações de integração atualizadas' };
        }),

    // --- API Key Management (Super Admin - Chaves Globais) ---
    createApiKey: superAdminProcedure
        .input(createApiKeySchema)
        .mutation(async ({ input }) => {
            console.log('[tRPC settings.createApiKey] Criando nova chave API global:', input.name);
            await connectToDatabase();

            const apiKey = `${input.name}-${Math.random().toString(36).substring(2, 15)}`;
            const encryptedApiKey = await encrypt(apiKey);

            const updatedSettings = await AppSettings.findOneAndUpdate(
                { tenantId: null },
                {
                    $push: { apiKeys: { name: input.name, key: encryptedApiKey, createdAt: new Date() } },
                    $set: { updatedAt: new Date() },
                },
                { new: true, upsert: true }
            );

            if (!updatedSettings) {
                console.error('[tRPC settings.createApiKey] Falha ao criar chave API');
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar chave API' });
            }

            console.log('[tRPC settings.createApiKey] Chave API criada com sucesso');
            return { success: true, message: 'Chave API criada', apiKey };
        }),

    revokeApiKey: superAdminProcedure
        .input(revokeApiKeySchema)
        .mutation(async ({ input }) => {
            console.log('[tRPC settings.revokeApiKey] Revogando chave API global:', input.id);
            await connectToDatabase();

            const updatedSettings = await AppSettings.findOneAndUpdate(
                { tenantId: null },
                {
                    $pull: { apiKeys: { key: input.id } },
                    $set: { updatedAt: new Date() },
                },
                { new: true }
            );

            if (!updatedSettings) {
                console.error('[tRPC settings.revokeApiKey] Falha ao revogar chave API ou chave não encontrada');
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Chave API não encontrada ou falha ao revogar' });
            }

            console.log('[tRPC settings.revokeApiKey] Chave API revogada com sucesso');
            return { success: true, message: 'Chave API revogada' };
        }),
});

export type SettingsRouter = typeof settingsRouter;
// ============================================================
// FIM DO ARQUIVO REFACTORADO: server/api/routers/settings.ts
// ============================================================