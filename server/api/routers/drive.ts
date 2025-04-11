// FILE: server/api/routers/drive.ts (Refatorado - Erro Corrigido)
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createDriveFolderSchema,
    listDriveFilesSchema,
    listDriveFilesResponseSchema,
    driveUploadDespesaSchema,
    driveUploadAnexoResponseSchema,
} from '../schemas/drive';
import type { Attachment } from '../schemas/despesas'; // Zod schema para validação de I/O
import { Empreendimento, Despesa } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import mongoose, { Types } from 'mongoose';
import { GoogleDriveService } from '@/server/services/integration/googleDrive.service';
import { logIntegration } from '@/server/services/logging/integrationLogger';
import type { Context } from '../context';
import {
    createEmpreendimentoFolders as libCreateEmpreendimentoFolders,
    listFilesInFolder,
} from '@/lib/google/drive';

export const driveRouter = router({
    createTenantEmpreendimentoFolders: tenantAdminProcedure
        .input(createDriveFolderSchema)
        .mutation(async ({ input, ctx }: { input: z.infer<typeof createDriveFolderSchema>, ctx: Context }) => {
            const tenantId = ctx.tenantId!;
            const action = 'CREATE_FOLDER';
            let status: 'SUCCESS' | 'ERROR' = 'ERROR';
            let logDetails: any = { empreendimentoId: input.empreendimentoId };
            try {
                await connectToDatabase();
                const empreendimento = await Empreendimento.findOne({
                    _id: new Types.ObjectId(input.empreendimentoId),
                    tenantId: new Types.ObjectId(tenantId),
                });
                if (!empreendimento) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado neste tenant' });
                }
                if (empreendimento.folderId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empreendimento já possui estrutura de pastas no Drive.' });
                }
                console.log(`[tRPC createTenantEmpreendimentoFolders] Chamando lib createEmpreendimentoFolders para: ${empreendimento.name}`);
                const result = await libCreateEmpreendimentoFolders(tenantId, input.empreendimentoId, empreendimento.name);
                logDetails = { ...logDetails, ...result };
                if (!result.success || !result.empreendimentoFolderId) {
                    throw new Error(result.error || 'Falha ao criar pastas no Google Drive');
                }
                await Empreendimento.findByIdAndUpdate(input.empreendimentoId, { folderId: result.empreendimentoFolderId });
                status = 'SUCCESS';
                console.log(`[tRPC createTenantEmpreendimentoFolders] Pastas criadas e DB atualizado. FolderId: ${result.empreendimentoFolderId}`);
                return {
                    success: true,
                    folderId: result.empreendimentoFolderId,
                    categoryFolders: result.categoryFolders,
                    message: 'Estrutura de pastas criada com sucesso no Google Drive.',
                };
            } catch (error: any) {
                console.error('[tRPC createTenantEmpreendimentoFolders] Erro:', error);
                logDetails.error = error.message || String(error);
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao criar estrutura de pastas no Drive',
                    cause: error.message,
                });
            } finally {
                await logIntegration(tenantId, 'GoogleDrive', action, status, logDetails);
            }
        }),

    uploadDespesaAnexo: protectedProcedure
        .input(driveUploadDespesaSchema)
        .output(driveUploadAnexoResponseSchema)
        .mutation(async ({ input, ctx }) => {
            const tenantId = ctx.user.tenantId || ctx.tenantId;
            if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não especificado.' });

            let logStatus: 'SUCCESS' | 'ERROR' | 'WARNING' = 'ERROR';
            let logDetails: any = { input };

            try {
                await connectToDatabase();
                const [empreendimento, despesa] = await Promise.all([
                    Empreendimento.findOne({
                        _id: new Types.ObjectId(input.empreendimentoId),
                        tenantId: new Types.ObjectId(tenantId),
                    }).select('folderId name').lean(),
                    Despesa.findById(input.despesaId), // Sem .lean() para permitir save()
                ]);

                if (!empreendimento) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `Empreendimento ${input.empreendimentoId} não encontrado neste tenant.` });
                }
                if (!despesa) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: `Despesa ${input.despesaId} não encontrada.` });
                }
                if (!despesa.tenantId?.equals(tenantId)) {
                    throw new TRPCError({ code: 'FORBIDDEN', message: 'Despesa não pertence a este tenant.' });
                }
                if (!empreendimento.folderId) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `Empreendimento ${empreendimento.name} não possui pasta configurada no Drive.` });
                }

                const isCreator = despesa.createdBy.equals(ctx.user.id);
                const isAdmin = ctx.user.role === 'admin';
                if (!isAdmin && !isCreator) {
                    throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para anexar a esta despesa.' });
                }

                const buffer = Buffer.from(input.content, 'base64');
                const fileData: { buffer: Buffer; originalname: string; mimetype: string } = {
                    buffer,
                    originalname: input.fileName,
                    mimetype: input.mimeType,
                };

                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
                const maxSize = 15 * 1024 * 1024; // 15MB
                if (!allowedTypes.includes(fileData.mimetype)) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: `Tipo de arquivo inválido: ${fileData.mimetype}` });
                }
                if (fileData.buffer.length > maxSize) {
                    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `Arquivo excede o limite de ${(maxSize / 1024 / 1024).toFixed(0)}MB` });
                }

                const driveService = new GoogleDriveService();
                const uploadResult = await driveService.uploadFile(
                    tenantId,
                    fileData,
                    empreendimento.folderId,
                    { category: input.category }
                );
                logDetails.driveResult = uploadResult;

                if (!uploadResult.success || !uploadResult.fileId || !uploadResult.url) {
                    throw new Error(uploadResult.error || 'Falha no upload via serviço Drive');
                }

                // Criar o attachment sem _id, Mongoose adicionará ObjectId automaticamente
                const newAttachment = {
                    fileId: uploadResult.fileId,
                    name: uploadResult.fileName,
                    url: uploadResult.url,
                };

                // Atribuir diretamente ao array attachments, sem especificar _id
                despesa.attachments = [newAttachment];
                despesa.updatedAt = new Date();
                await despesa.save();

                logStatus = 'SUCCESS';
                logDetails.dbUpdate = 'Success';
                console.log(`[tRPC uploadDespesaAnexo] Despesa ${input.despesaId} atualizada no DB.`);

                return driveUploadAnexoResponseSchema.parse({
                    success: true,
                    fileId: uploadResult.fileId,
                    fileName: uploadResult.fileName,
                    url: uploadResult.url,
                    message: 'Anexo enviado e vinculado à despesa com sucesso.',
                });
            } catch (error: any) {
                console.error('[tRPC uploadDespesaAnexo] Erro:', error);
                logDetails.error = error instanceof Error ? error.message : String(error);
                await logIntegration(tenantId, 'GoogleDrive', 'UPLOAD', 'ERROR', logDetails)
                    .catch(logErr => console.error("[tRPC uploadDespesaAnexo] Falha ao registrar log:", logErr));

                if (error instanceof TRPCError) throw error;
                return driveUploadAnexoResponseSchema.parse({
                    success: false,
                    message: 'Erro interno ao processar anexo da despesa',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    listFiles: tenantAdminProcedure
        .input(listDriveFilesSchema)
        .output(listDriveFilesResponseSchema)
        .query(async ({ input, ctx }) => {
            const tenantId = ctx.tenantId!;
            let logStatus: 'SUCCESS' | 'ERROR' = 'ERROR';
            let logDetails: any = { folderId: input.folderId };
            try {
                console.log(`[tRPC drive.listFiles] Listando arquivos para Folder ID: ${input.folderId} por Tenant: ${tenantId}`);
                const result = await listFilesInFolder(tenantId, input.folderId);
                if (!result.success || !result.files) {
                    throw new Error(result.error || 'Falha ao listar arquivos da pasta.');
                }
                logStatus = 'SUCCESS';
                logDetails.fileCount = result.files.length;
                const clientFiles = result.files
                    .filter(file => file?.id && file.mimeType !== 'application/vnd.google-apps.folder')
                    .map(file => ({
                        id: file.id!,
                        name: file.name || 'Sem nome',
                        mimeType: file.mimeType || 'application/octet-stream',
                        webViewLink: file.webViewLink || undefined,
                        webContentLink: file.webContentLink || undefined,
                        createdTime: file.createdTime || undefined,
                        size: file.size || undefined,
                    }));
                return listDriveFilesResponseSchema.parse({ files: clientFiles });
            } catch (error: any) {
                console.error('[tRPC drive.listFiles] Erro:', error);
                logDetails.error = error.message || String(error);
                if (error instanceof TRPCError) throw error;
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Erro ao listar arquivos da pasta do Drive',
                    cause: error.message,
                });
            } finally {
                await logIntegration(tenantId, 'GoogleDrive', 'DOWNLOAD', logStatus, logDetails);
            }
        }),
});

export type DriveRouter = typeof driveRouter;
// ============================================================
// FIM DO ARQUIVO REFATORADO: server/api/routers/drive.ts
// ============================================================