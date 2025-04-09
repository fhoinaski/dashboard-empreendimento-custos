import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    updateProfileSchema,
    changePasswordSchema,
    updateCompanySettingsSchema,
    updateNotificationSettingsSchema,
    updateApiKeysSchema,
    getApiKeysResponseSchema,
    getNotificationSettingsResponseSchema,
    getCompanySettingsResponseSchema,
    getProfileSettingsResponseSchema,
    createApiKeySchema, // Assuming these are defined if used
    revokeApiKeySchema, // Assuming these are defined if used
} from '../schemas/settings';
import connectToDatabase from '@/lib/db/mongodb';
import { AppSettings, User, AppSettingsDocument } from '@/lib/db/models'; // Import AppSettingsDocument
import { hash, compare } from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { encrypt, decrypt } from '@/lib/crypto';
// Import S3 upload function if handling avatar upload here
// import { uploadFileToS3 } from '@/lib/s3';

// Interface for lean AppSettings document (matching response schema structure)
interface AppSettingsLeanResponse {
    _id: string;
    companyName?: string | null;
    cnpj?: string | null;
    companyAddress?: string | null;
    companyPhone?: string | null;
    companyEmail?: string | null;
    logoUrl?: string | null;
    updatedAt: Date; // Keep as Date initially from lean
    // Include encrypted fields if needed elsewhere, but not for response
    googleApiKeyEncrypted?: string | null;
    awsApiKeyEncrypted?: string | null;
    awsSecretKeyEncrypted?: string | null;
}

/**
 * Roteador para configurações
 */
export const settingsRouter = router({

    // --- Profile Settings ---
    // Equivalente a: GET (implícito, dados vêm da sessão/DB) e PUT /api/settings/profile
    getProfileSettings: protectedProcedure
        .output(getProfileSettingsResponseSchema)
        .query(async ({ ctx }) => {
            console.log(`[tRPC settings.getProfileSettings] Buscando perfil para usuário: ${ctx.user.id}`);
            try {
                await connectToDatabase();
                const user = await User.findById(ctx.user.id)
                    .select('name email avatarUrl') // Seleciona apenas os campos necessários
                    .lean<{ name: string; email: string; avatarUrl?: string | null } | null>(); // Tipagem Lean

                if (!user) {
                    console.error(`[tRPC settings.getProfileSettings] Usuário não encontrado: ${ctx.user.id}`);
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
                }
                 console.log(`[tRPC settings.getProfileSettings] Perfil encontrado para: ${user.email}`);
                return getProfileSettingsResponseSchema.parse({ // Valida o output
                    name: user.name,
                    email: user.email,
                    avatarUrl: user.avatarUrl ?? null,
                });
            } catch (error) {
                console.error("[tRPC settings.getProfileSettings] Erro:", error);
                 if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar perfil' });
            }
        }),

    updateProfile: protectedProcedure
        .input(updateProfileSchema.extend({
             // Add fields for base64 upload if needed
             // avatarBase64: z.string().optional(),
             // avatarFileName: z.string().optional(),
             // avatarMimeType: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            console.log(`[tRPC settings.updateProfile] Atualizando perfil para usuário: ${ctx.user.id}`, input);
            try {
                await connectToDatabase();
                const userId = ctx.user.id;
                const user = await User.findById(userId);
                if (!user) {
                     console.error(`[tRPC settings.updateProfile] Usuário não encontrado: ${userId}`);
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
                }

                const updateData: { name?: string; avatarUrl?: string | null; updatedAt: Date } = {
                    updatedAt: new Date()
                };

                if (input.name !== undefined && input.name !== user.name) {
                    updateData.name = input.name;
                     console.log(`[tRPC settings.updateProfile] Atualizando nome para: ${updateData.name}`);
                }

                // --- Avatar Handling ---
                // Option 1: If URL is passed directly (upload handled elsewhere)
                 if (input.avatarUrl !== undefined) {
                    updateData.avatarUrl = input.avatarUrl; // Accepts null to remove
                    console.log(`[tRPC settings.updateProfile] Atualizando avatarUrl para: ${updateData.avatarUrl}`);
                 }

                // Option 2: Handle Base64 Upload Here (Requires S3 helper and schema adjustment)
                /*
                if (input.avatarBase64 && input.avatarFileName && input.avatarMimeType) {
                    console.log(`[tRPC settings.updateProfile] Processando upload de avatar base64: ${input.avatarFileName}`);
                    const buffer = Buffer.from(input.avatarBase64, 'base64');
                    const bucketName = process.env.AWS_S3_BUCKET_NAME;
                    if (!bucketName) throw new Error("Bucket S3 não configurado.");

                    // Basic validation (could use Zod refine)
                    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (!allowedTypes.includes(input.avatarMimeType)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tipo de avatar inválido.' });
                    if (buffer.length > maxSize) throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'Avatar excede 5MB.' });

                    const uniqueFileName = `avatars/${userId}-${Date.now()}-${input.avatarFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
                    const uploadResult = await uploadFileToS3({ buffer, originalname: uniqueFileName, mimetype: input.avatarMimeType }, bucketName);

                    if (!uploadResult.success || !uploadResult.url) {
                         console.error(`[tRPC settings.updateProfile] Falha no upload S3: ${uploadResult.error}`);
                        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: uploadResult.error || "Falha no upload do avatar." });
                    }
                    updateData.avatarUrl = uploadResult.url;
                    console.log(`[tRPC settings.updateProfile] Upload S3 OK. Nova URL: ${updateData.avatarUrl}`);
                }
                */
                // --- End Avatar Handling ---

                 // Check if there's anything to update besides timestamp
                 if (Object.keys(updateData).length <= 1) {
                    console.log("[tRPC settings.updateProfile] Nenhum campo alterado.");
                    // Return current data without hitting the DB again if possible
                    return {
                        success: true,
                        message: 'Nenhuma alteração detectada no perfil.',
                        user: getProfileSettingsResponseSchema.parse({ name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null })
                    };
                 }

                 console.log("[tRPC settings.updateProfile] Dados para $set:", updateData);
                const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true })
                    .select('name email avatarUrl')
                    .lean<{ name: string; email: string; avatarUrl?: string | null } | null>();

                if (!updatedUser) {
                     console.error(`[tRPC settings.updateProfile] Falha ao encontrar usuário ${userId} após update.`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao atualizar usuário no banco.' });
                }
                console.log("[tRPC settings.updateProfile] Perfil atualizado com sucesso.");

                return {
                    success: true,
                    message: 'Perfil atualizado com sucesso',
                    user: getProfileSettingsResponseSchema.parse({ // Validate output
                        name: updatedUser.name,
                        email: updatedUser.email,
                        avatarUrl: updatedUser.avatarUrl ?? null
                    })
                };
            } catch (error) {
                if (error instanceof TRPCError) throw error;
                console.error("[tRPC settings.updateProfile] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar perfil' });
            }
        }),

    // --- Password Settings ---
    // Equivalente a: PUT /api/settings/password
    updatePassword: protectedProcedure
        .input(changePasswordSchema)
        .mutation(async ({ input, ctx }) => {
             console.log(`[tRPC settings.updatePassword] Usuário: ${ctx.user.id}`);
            try {
                await connectToDatabase();
                const userId = ctx.user.id;
                const user = await User.findById(userId);
                if (!user) {
                    console.error(`[tRPC settings.updatePassword] Usuário não encontrado: ${userId}`);
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
                }

                console.log(`[tRPC settings.updatePassword] Verificando senha atual...`);
                const isPasswordValid = await compare(input.currentPassword, user.password);
                if (!isPasswordValid) {
                     console.warn(`[tRPC settings.updatePassword] Senha atual incorreta para usuário ${userId}`);
                    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' });
                }
                console.log(`[tRPC settings.updatePassword] Senha atual OK. Hashing nova senha...`);

                const hashedPassword = await hash(input.newPassword, 12);
                user.password = hashedPassword;
                user.updatedAt = new Date();
                await user.save();
                console.log(`[tRPC settings.updatePassword] Senha atualizada com sucesso para ${userId}.`);

                return { success: true, message: 'Senha atualizada com sucesso' };
            } catch (error) {
                if (error instanceof TRPCError) throw error;
                console.error("[tRPC settings.updatePassword] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao alterar senha' });
            }
        }),

    // --- Company Settings ---
    // Equivalente a: GET /api/settings/company
    getCompanySettings: adminProcedure
        .output(getCompanySettingsResponseSchema)
        .query(async (): Promise<z.infer<typeof getCompanySettingsResponseSchema>> => {
             console.log("[tRPC settings.getCompanySettings] Buscando configurações...");
            try {
                await connectToDatabase();
                const settings = await AppSettings.findOne({ _id: 'global_settings' })
                    .lean<AppSettingsLeanResponse | null>();

                const defaultResponse = {
                    _id: 'global_settings', companyName: null, cnpj: null, companyAddress: null,
                    companyPhone: null, companyEmail: null, logoUrl: null, updatedAt: new Date().toISOString(),
                };

                if (!settings) {
                    console.log("[tRPC settings.getCompanySettings] Nenhuma configuração encontrada, retornando default.");
                    return defaultResponse;
                }
                 console.log("[tRPC settings.getCompanySettings] Configurações encontradas.");
                // Map and validate before returning
                return getCompanySettingsResponseSchema.parse({
                    _id: settings._id,
                    companyName: settings.companyName ?? null,
                    cnpj: settings.cnpj ?? null,
                    companyAddress: settings.companyAddress ?? null,
                    companyPhone: settings.companyPhone ?? null,
                    companyEmail: settings.companyEmail ?? null,
                    logoUrl: settings.logoUrl ?? null,
                    updatedAt: settings.updatedAt.toISOString(),
                });

            } catch (error) {
                console.error("[tRPC settings.getCompanySettings] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar config. da empresa' });
            }
        }),

    // Equivalente a: PUT /api/settings/company
    updateCompanySettings: adminProcedure
        .input(updateCompanySettingsSchema.extend({
             // Add fields for base64 upload if handling logo here
             // logoBase64: z.string().optional(),
             // logoFileName: z.string().optional(),
             // logoMimeType: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
             console.log("[tRPC settings.updateCompanySettings] Input:", input);
            try {
                await connectToDatabase();
                 // Prepare update data
                 const { /* logoBase64, logoFileName, logoMimeType, */ ...companyData } = input;
                 const updateData: Partial<Omit<AppSettingsDocument, '_id'>> & { updatedAt: Date } = { // Ensure updatedAt is always included
                    updatedAt: new Date()
                 };

                 // Include fields only if they are present in the input
                 for (const [key, value] of Object.entries(companyData)) {
                     if (value !== undefined) {
                         updateData[key as keyof typeof updateData] = value;
                     }
                 }


                 // --- Logo Handling (Example using direct URL) ---
                 if (input.logoUrl !== undefined) { // Check if logoUrl was part of the input
                      updateData.logoUrl = input.logoUrl; // Set to null if input was null
                       console.log(`[tRPC settings.updateCompanySettings] Atualizando logoUrl para: ${updateData.logoUrl}`);
                  }
                 // If using base64, decode, upload to S3, then set updateData.logoUrl = s3Result.url
                 // --- End Logo Handling ---

                 console.log("[tRPC settings.updateCompanySettings] Dados para $set:", updateData);
                const updatedSettingsDoc = await AppSettings.findOneAndUpdate(
                    { _id: 'global_settings' },
                    { $set: updateData },
                    { new: true, upsert: true, runValidators: true }
                ).lean<AppSettingsLeanResponse | null>();

                if (!updatedSettingsDoc) {
                     console.error("[tRPC settings.updateCompanySettings] Falha ao salvar configurações da empresa.");
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao salvar configurações da empresa.' });
                }
                 console.log("[tRPC settings.updateCompanySettings] Configurações atualizadas com sucesso.");

                // Map to response schema
                const responseSettings = getCompanySettingsResponseSchema.parse({
                    _id: updatedSettingsDoc._id,
                    companyName: updatedSettingsDoc.companyName ?? null,
                    cnpj: updatedSettingsDoc.cnpj ?? null,
                    companyAddress: updatedSettingsDoc.companyAddress ?? null,
                    companyPhone: updatedSettingsDoc.companyPhone ?? null,
                    companyEmail: updatedSettingsDoc.companyEmail ?? null,
                    logoUrl: updatedSettingsDoc.logoUrl ?? null,
                    updatedAt: updatedSettingsDoc.updatedAt.toISOString(),
                });

                return {
                    success: true,
                    message: 'Configurações da empresa atualizadas.',
                    settings: responseSettings
                };
            } catch (error) {
                if (error instanceof mongoose.Error.ValidationError) {
                     console.error("[tRPC settings.updateCompanySettings] Erro de Validação:", error.errors);
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
                }
                console.error("[tRPC settings.updateCompanySettings] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar config. da empresa' });
            }
        }),

    // --- Notification Settings ---
    // Equivalente a: GET /api/settings/notifications
    getNotificationSettings: protectedProcedure
        .output(getNotificationSettingsResponseSchema)
        .query(async ({ ctx }) => {
             console.log(`[tRPC settings.getNotificationSettings] Buscando para usuário: ${ctx.user.id}`);
            try {
                await connectToDatabase();
                const user = await User.findById(ctx.user.id)
                    .select('notificationPreferences')
                    .lean<{ notificationPreferences?: z.infer<typeof getNotificationSettingsResponseSchema> } | null>();
                if (!user) {
                    console.error(`[tRPC settings.getNotificationSettings] Usuário não encontrado: ${ctx.user.id}`);
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
                }
                // Return saved preferences or defaults if none exist
                const prefs = user.notificationPreferences || {
                    emailDespesasVencer: true, emailDocumentosNovos: true, emailRelatoriosSemanais: false,
                    systemDespesasVencer: true, systemDocumentosNovos: true, systemEventosCalendario: true,
                    antecedenciaVencimento: 3,
                };
                 console.log(`[tRPC settings.getNotificationSettings] Preferências encontradas/padrão:`, prefs);
                return getNotificationSettingsResponseSchema.parse(prefs); // Validate output
            } catch (error) {
                console.error("[tRPC settings.getNotificationSettings] Erro:", error);
                 if (error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar pref. de notificação' });
            }
        }),

    // Equivalente a: PUT /api/settings/notifications
    updateNotificationSettings: protectedProcedure
        .input(updateNotificationSettingsSchema)
        .mutation(async ({ input, ctx }) => {
             console.log(`[tRPC settings.updateNotificationSettings] Atualizando para usuário: ${ctx.user.id}`, input);
            try {
                await connectToDatabase();
                const updatedUser = await User.findByIdAndUpdate(
                    ctx.user.id,
                    { $set: { notificationPreferences: input, updatedAt: new Date() } },
                    { new: true, runValidators: true }
                ).select('notificationPreferences');

                if (!updatedUser) {
                     console.error(`[tRPC settings.updateNotificationSettings] Usuário não encontrado: ${ctx.user.id}`);
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
                }
                 console.log(`[tRPC settings.updateNotificationSettings] Preferências atualizadas com sucesso.`);

                return {
                     success: true,
                     message: 'Preferências de notificação atualizadas.',
                     // Return the updated preferences, validated
                     preferences: getNotificationSettingsResponseSchema.parse(updatedUser.notificationPreferences)
                 };
            } catch (error) {
                if (error instanceof mongoose.Error.ValidationError) {
                     console.error("[tRPC settings.updateNotificationSettings] Erro de Validação:", error.errors);
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
                }
                console.error("[tRPC settings.updateNotificationSettings] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao salvar pref. de notificação' });
            }
        }),

    // --- API Key Settings ---
    // Equivalente a: GET /api/settings/api-keys
    getApiKeys: adminProcedure
        .output(getApiKeysResponseSchema)
        .query(async () => {
            console.log("[tRPC settings.getApiKeys] Verificando status das chaves...");
            try {
                await connectToDatabase();
                const settings = await AppSettings.findOne({ _id: 'global_settings' })
                    .select('googleApiKeyEncrypted awsApiKeyEncrypted') // Select only necessary fields
                    .lean<{ googleApiKeyEncrypted?: string | null; awsApiKeyEncrypted?: string | null } | null>();

                const response = {
                    googleConfigured: !!settings?.googleApiKeyEncrypted,
                    awsConfigured: !!settings?.awsApiKeyEncrypted,
                };
                 console.log("[tRPC settings.getApiKeys] Status:", response);
                return getApiKeysResponseSchema.parse(response); // Validate output
            } catch (error) {
                console.error("[tRPC settings.getApiKeys] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao verificar chaves API' });
            }
        }),

    // Equivalente a: PUT /api/settings/api-keys
    updateApiKeys: adminProcedure
        .input(updateApiKeysSchema)
        .mutation(async ({ input }) => {
            console.log("[tRPC settings.updateApiKeys] Input recebido (chaves omitidas no log intencionalmente).");
             // console.log("[tRPC settings.updateApiKeys] Input:", input); // Log keys only if absolutely necessary for debug
            try {
                await connectToDatabase();
                // Use Partial<AppSettingsDocument> for flexibility with $set
                const updateData: Partial<Pick<AppSettingsDocument, 'googleApiKeyEncrypted' | 'awsApiKeyEncrypted' | 'awsSecretKeyEncrypted' | 'updatedAt'>> & { updatedAt: Date } = {
                    updatedAt: new Date()
                };

                // Encrypt keys if provided, set to null if empty string/null provided
                if (input.googleApiKey !== undefined) {
                     console.log("[tRPC settings.updateApiKeys] Processando chave Google...");
                    updateData.googleApiKeyEncrypted = input.googleApiKey ? await encrypt(input.googleApiKey) : null;
                     console.log(`[tRPC settings.updateApiKeys] Chave Google ${updateData.googleApiKeyEncrypted ? 'criptografada' : 'removida'}.`);
                }
                if (input.awsApiKey !== undefined) {
                     console.log("[tRPC settings.updateApiKeys] Processando chave AWS...");
                    updateData.awsApiKeyEncrypted = input.awsApiKey ? await encrypt(input.awsApiKey) : null;
                     console.log(`[tRPC settings.updateApiKeys] Chave AWS ${updateData.awsApiKeyEncrypted ? 'criptografada' : 'removida'}.`);
                }
                if (input.awsSecretKey !== undefined) {
                     console.log("[tRPC settings.updateApiKeys] Processando segredo AWS...");
                    updateData.awsSecretKeyEncrypted = input.awsSecretKey ? await encrypt(input.awsSecretKey) : null;
                      console.log(`[tRPC settings.updateApiKeys] Segredo AWS ${updateData.awsSecretKeyEncrypted ? 'criptografado' : 'removido'}.`);
                }

                if (Object.keys(updateData).length <= 1) { // Only updatedAt
                     console.log("[tRPC settings.updateApiKeys] Nenhuma chave fornecida para atualização.");
                    return { success: true, message: 'Nenhuma chave API fornecida para atualização.' };
                }

                 console.log("[tRPC settings.updateApiKeys] Atualizando documento AppSettings...");
                await AppSettings.findOneAndUpdate(
                    { _id: 'global_settings' },
                    { $set: updateData },
                    { upsert: true, new: true, runValidators: true } // Ensure document exists
                );
                 console.log("[tRPC settings.updateApiKeys] Chaves API atualizadas no DB.");

                return { success: true, message: 'Chaves de API atualizadas com sucesso.' };
            } catch (error) {
                if (error instanceof mongoose.Error.ValidationError) {
                    console.error("[tRPC settings.updateApiKeys] Erro de Validação:", error.errors);
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dados inválidos', cause: error });
                }
                console.error("[tRPC settings.updateApiKeys] Erro:", error);
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao atualizar chaves API' });
            }
        }),

    // --- Placeholder API Key Management ---
    // TODO: Implement logic if API key generation/revocation is needed
    createApiKey: adminProcedure
        .input(createApiKeySchema)
        .mutation(async ({ input, ctx }) => {
            console.warn("tRPC settings.createApiKey procedure not fully implemented.");
            // Placeholder logic
            await new Promise(res => setTimeout(res, 500));
            const generatedKey = `sk_${Date.now()}${Math.random().toString(36).substring(2, 10)}`;
            // In real implementation: generate secure key, store hash, associate with user/permissions
            return { success: true, apiKey: generatedKey, message: "Chave API gerada (simulação)." };
        }),

    revokeApiKey: adminProcedure
        .input(revokeApiKeySchema)
        .mutation(async ({ input, ctx }) => {
            console.warn("tRPC settings.revokeApiKey procedure not fully implemented.");
            // Placeholder logic
            await new Promise(res => setTimeout(res, 300));
            // In real implementation: find key by ID, mark as revoked or delete
            console.log(`[tRPC settings.revokeApiKey] Revogando chave ID: ${input.id}`);
            return { success: true, message: "Chave API revogada (simulação)." };
        }),
});

export type SettingsRouter = typeof settingsRouter;