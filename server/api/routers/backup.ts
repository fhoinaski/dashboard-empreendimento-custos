// FILE: server/api/routers/backup.ts (Integrado e Corrigido)
// ============================================================
import { router, protectedProcedure, tenantAdminProcedure, superAdminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Tenant, User, Empreendimento, Despesa, Documento, AppSettings, Notification, IntegrationLog } from '@/lib/db/models';
import { format } from 'date-fns';
import {
    generateCsvResponseSchema,
    saveToDriveResponseSchema,
    type GenerateCsvResponse,
    type SaveToDriveResponse,
    createBackupSchema,
} from '../schemas/backup';
import mongoose, { Types } from 'mongoose';
import { TenantService } from '@/server/services/tenant.service';
import { uploadFileToDrive } from '@/lib/google/drive';
import { logIntegration } from '@/server/services/logging/integrationLogger';
import type { Context } from '../context';

// Função auxiliar para escapar valores CSV
function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    let stringValue = String(value);
    if (value instanceof Date) {
        try { stringValue = format(value, 'yyyy-MM-dd HH:mm:ss'); } catch { stringValue = "Data Inválida"; }
    } else if (value instanceof mongoose.Types.ObjectId) {
        stringValue = value.toString();
    } else if (Array.isArray(value)) {
        stringValue = value.map(item => item?.toString() ?? '').join(';');
    } else if (typeof value === 'object' && value !== null && '_id' in value) {
        stringValue = value._id?.toString() ?? '';
    }
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        stringValue = stringValue.replace(/"/g, '""');
        return `"${stringValue}"`;
    }
    return stringValue;
}

// Função auxiliar para converter documentos em linhas CSV
function documentsToCsvLines(docs: any[], headers: string[]): string {
    return docs.map(doc => {
        const plainDoc = doc.toObject ? doc.toObject() : doc;
        return headers.map(header => escapeCsvValue(plainDoc[header])).join(',');
    }).join('\n');
}

// Função utilitária para slugify
function slugify(text: string, options?: { lower?: boolean; strict?: boolean }): string {
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüúūǘůűųẃẍÿýžźż·/_,:;';
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrrsssssttuuuuuuuuuwxyyzzz------';
    const p = new RegExp(a.split('').join('|'), 'g');

    return text.toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(p, c => b.charAt(a.indexOf(c)))
        .replace(/&/g, '-and-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export const backupRouter = router({
    /**
     * Gera um backup completo de todas as coleções como uma string CSV.
     * Apenas super administradores podem executar (full DB dump).
     */
    generateCsv: superAdminProcedure
        .output(generateCsvResponseSchema)
        .mutation(async ({ ctx }: { ctx: Context }): Promise<GenerateCsvResponse> => {
            console.log(`[tRPC backup.generateCsv] Iniciado por: ${ctx.user!.email}`);
            try {
                await connectToDatabase();
                const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
                const fileName = `backup_orbigestao_full_${timestamp}.csv`;
                let csvContent = "\ufeff";

                const collectionsToBackup = [
                    { name: "Tenants", model: Tenant, headers: ['_id', 'name', 'slug', 'status', 'createdAt', 'updatedAt'] },
                    { name: "AppSettings", model: AppSettings, headers: ['_id', 'tenantId', 'companyName', 'cnpj', 'companyAddress', 'companyPhone', 'companyEmail', 'logoUrl', 'googleDriveEnabled', 'googleSheetsEnabled', 'updatedAt'] },
                    { name: "Users", model: User, headers: ['_id', 'tenantId', 'name', 'email', 'role', 'avatarUrl', 'createdAt', 'updatedAt', 'assignedEmpreendimentos'] },
                    { name: "Empreendimentos", model: Empreendimento, headers: ['_id', 'tenantId', 'name', 'address', 'type', 'status', 'totalUnits', 'soldUnits', 'startDate', 'endDate', 'responsiblePerson', 'contactEmail', 'contactPhone', 'folderId', 'sheetId', 'createdBy', 'createdAt', 'updatedAt'] },
                    { name: "Despesas", model: Despesa, headers: ['_id', 'tenantId', 'description', 'value', 'date', 'dueDate', 'status', 'category', 'paymentMethod', 'approvalStatus', 'reviewedAt', 'notes', 'empreendimento', 'createdBy', 'reviewedBy', 'createdAt', 'updatedAt'] },
                    { name: "Documentos", model: Documento, headers: ['_id', 'tenantId', 'name', 'type', 'category', 'fileId', 'url', 'empreendimento', 'createdBy', 'createdAt', 'updatedAt'] },
                    { name: "Notifications", model: Notification, headers: ['_id', 'tenantId', 'titulo', 'mensagem', 'tipo', 'destinatarioId', 'empreendimentoId', 'lida', 'createdAt', 'updatedAt'] },
                ];

                for (const { name, model, headers } of collectionsToBackup) {
                    console.log(`[tRPC backup.generateCsv] Buscando ${name}...`);
                    const documents = await (model as mongoose.Model<any>)
                        .find()
                        .select('-__v' + (name === 'Users' ? ' -password' : ''))
                        .lean();
                    csvContent += `--- ${name.toUpperCase()} ---\n`;
                    csvContent += headers.map(escapeCsvValue).join(',') + '\n';
                    csvContent += documentsToCsvLines(documents, headers) + '\n\n';
                    console.log(`[tRPC backup.generateCsv] ${documents.length} ${name.toLowerCase()} adicionados.`);
                }

                console.log(`[tRPC backup.generateCsv] Geração CSV concluída. Nome: ${fileName}, Tamanho: ~${(csvContent.length / 1024).toFixed(2)} KB`);

                return generateCsvResponseSchema.parse({
                    success: true,
                    csvContent,
                    fileName,
                    message: "Backup CSV completo gerado com sucesso.",
                });
            } catch (error) {
                console.error('[tRPC backup.generateCsv] Erro:', error);
                return generateCsvResponseSchema.parse({
                    success: false,
                    message: 'Falha ao gerar backup CSV completo.',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }),

    /**
     * Gera um backup CSV dos dados de um tenant específico e salva no Google Drive.
     * Apenas administradores de tenant podem executar.
     */
    saveTenantBackupToDrive: tenantAdminProcedure
        .input(createBackupSchema.optional())
        .output(saveToDriveResponseSchema)
        .mutation(async ({ ctx }: { ctx: Context }): Promise<SaveToDriveResponse> => {
            const tenantId = ctx.tenantId!; // Garantido por tenantAdminProcedure
            const userId = ctx.user!.id;    // Garantido por protectedProcedure
            console.log(`[tRPC backup.saveTenantBackupToDrive] Iniciado por User: ${userId} para Tenant: ${tenantId}`);
            let logStatus: 'SUCCESS' | 'ERROR' = 'ERROR';
            let logDetails: any = {};

            try {
                await connectToDatabase();

                const tenantService = new TenantService();
                const tenantConfig = await tenantService.getTenantConfig(tenantId);
                const appSettings = await AppSettings.findOne({ tenantId: new Types.ObjectId(tenantId) })
                    .select('companyName googleServiceAccountJsonEncrypted')
                    .lean();

                if (!tenantConfig?.googleDriveEnabled) {
                    logDetails.error = 'Google Drive integration disabled for this tenant.';
                    console.warn(`[tRPC backup.saveTenantBackupToDrive] ${logDetails.error}`);
                    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: logDetails.error });
                }
                if (!appSettings?.googleServiceAccountJsonEncrypted) {
                    logDetails.error = 'Google Service Account not configured for this tenant.';
                    console.warn(`[tRPC backup.saveTenantBackupToDrive] ${logDetails.error}`);
                    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: logDetails.error });
                }
                console.log(`[tRPC backup.saveTenantBackupToDrive] Configurações Drive OK para Tenant ${tenantId}.`);

                const collectionsToBackup = [
                    { name: "AppSettings", model: AppSettings, headers: ['_id', 'companyName', 'cnpj', 'companyAddress', 'companyPhone', 'companyEmail', 'logoUrl', 'googleDriveEnabled', 'googleSheetsEnabled', 'updatedAt'] },
                    { name: "Users", model: User, headers: ['_id', 'name', 'email', 'role', 'avatarUrl', 'createdAt', 'updatedAt', 'assignedEmpreendimentos'] },
                    { name: "Empreendimentos", model: Empreendimento, headers: ['_id', 'name', 'address', 'type', 'status', 'totalUnits', 'soldUnits', 'startDate', 'endDate', 'responsiblePerson', 'contactEmail', 'contactPhone', 'folderId', 'sheetId', 'createdBy', 'createdAt', 'updatedAt'] },
                    { name: "Despesas", model: Despesa, headers: ['_id', 'description', 'value', 'date', 'dueDate', 'status', 'category', 'paymentMethod', 'approvalStatus', 'reviewedAt', 'notes', 'empreendimento', 'createdBy', 'reviewedBy', 'createdAt', 'updatedAt'] },
                    { name: "Documentos", model: Documento, headers: ['_id', 'name', 'type', 'category', 'fileId', 'url', 'empreendimento', 'createdBy', 'createdAt', 'updatedAt'] },
                    { name: "Notifications", model: Notification, headers: ['_id', 'titulo', 'mensagem', 'tipo', 'destinatarioId', 'empreendimentoId', 'lida', 'createdAt', 'updatedAt'] },
                ];

                let csvContent = "\ufeff";
                const tenantFilter = { tenantId: new Types.ObjectId(tenantId) };
                logDetails.collections = {};

                for (const { name, model, headers } of collectionsToBackup) {
                    console.log(`[tRPC backup.saveTenantBackupToDrive] Fetching ${name} for Tenant ${tenantId}...`);
                    const documents = await (model as mongoose.Model<any>)
                        .find(tenantFilter)
                        .select('-__v' + (name === 'Users' ? ' -password' : ''))
                        .lean();
                    csvContent += `--- ${name.toUpperCase()} ---\n`;
                    csvContent += headers.map(escapeCsvValue).join(',') + '\n';
                    csvContent += documentsToCsvLines(documents, headers) + '\n\n';
                    logDetails.collections[name] = documents.length;
                    console.log(`[tRPC backup.saveTenantBackupToDrive] ${documents.length} ${name.toLowerCase()} adicionados ao CSV.`);
                }

                const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
                const tenantNameSlug = slugify(appSettings?.companyName || tenantId, { lower: true, strict: true });
                const backupFileName = `backup_${tenantNameSlug}_${timestamp}.csv`;
                const csvBuffer = Buffer.from(csvContent, 'utf-8');
                const fileData = { buffer: csvBuffer, originalname: backupFileName, mimetype: 'text/csv' };
                console.log(`[tRPC backup.saveTenantBackupToDrive] CSV gerado: ${backupFileName}, Tamanho: ${(csvBuffer.length / 1024).toFixed(2)} KB`);

                const backupFolderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
                if (!backupFolderId) {
                    logDetails.error = 'Backup folder ID (GOOGLE_DRIVE_BACKUP_FOLDER_ID) not configured.';
                    console.error(`[tRPC backup.saveTenantBackupToDrive] ${logDetails.error}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: logDetails.error });
                }
                console.log(`[tRPC backup.saveTenantBackupToDrive] Uploading to Drive Folder: ${backupFolderId}`);

                const uploadResult = await uploadFileToDrive(tenantId, fileData, backupFolderId, 'Backups');

                if (!uploadResult.success || !uploadResult.fileId) {
                    logDetails.error = `Drive Upload Failed: ${uploadResult.error || 'Unknown Drive error'}`;
                    console.error(`[tRPC backup.saveTenantBackupToDrive] ${logDetails.error}`);
                    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: logDetails.error });
                }

                logStatus = 'SUCCESS';
                logDetails.fileId = uploadResult.fileId;
                logDetails.fileName = backupFileName;
                logDetails.fileSizeKB = (csvBuffer.length / 1024).toFixed(2);
                console.log(`[tRPC backup.saveTenantBackupToDrive] Backup salvo no Drive. File ID: ${uploadResult.fileId}`);

                return saveToDriveResponseSchema.parse({
                    success: true,
                    message: `Backup do tenant salvo com sucesso no Google Drive (${backupFileName}).`,
                    driveFileId: uploadResult.fileId,
                });
            } catch (error) {
                console.error('[tRPC backup.saveTenantBackupToDrive] Erro:', error);
                logDetails.error = error instanceof Error ? error.message : String(error);
                if (error instanceof TRPCError) throw error;
                return saveToDriveResponseSchema.parse({
                    success: false,
                    message: "Falha ao salvar backup no Drive.",
                    error: logDetails.error,
                });
            } finally {
                await logIntegration(tenantId, 'GoogleDrive', 'BACKUP', logStatus, logDetails)
                    .catch(logErr => console.error("[tRPC backup.saveTenantBackupToDrive] Falha ao registrar log:", logErr));
            }
        }),
});

export type BackupRouter = typeof backupRouter;
// ============================================================
// FIM DO ARQUIVO CORRIGIDO: server/api/routers/backup.ts
// ============================================================