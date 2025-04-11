// FILE: server/services/integration/googleDrive.service.ts (Corrigido)
// ============================================================
import mongoose from 'mongoose';
import {
    IntegrationService,
    FileData,
    UploadResult,
    CreateFolderResult,
    SyncResult, // Adicionado ao import
} from './interface';
import {
    uploadFileToDrive as libUploadFileToDrive,
    createEmpreendimentoFolders as libCreateEmpreendimentoFolders,
    deleteFileFromDrive as libDeleteFileFromDrive,
} from '@/lib/google/drive';
import { logIntegration } from '@/server/services/logging/integrationLogger';

export class GoogleDriveService implements IntegrationService {
    async uploadFile(
        tenantId: string,
        file: FileData,
        destinationIdentifier: string,
        options?: { category?: string }
    ): Promise<UploadResult> {
        const action = 'UPLOAD';
        const category = options?.category ?? 'Outros';
        let status: 'SUCCESS' | 'ERROR' = 'ERROR';
        let logDetails: any = { fileName: file.originalname, folderId: destinationIdentifier, category };

        try {
            const result = await libUploadFileToDrive(
                tenantId,
                file,
                destinationIdentifier,
                category
            );

            logDetails = { ...logDetails, ...result };

            if (result.success) {
                status = 'SUCCESS';
                return result;
            } else {
                throw new Error(result.error || 'Unknown error during Drive upload');
            }
        } catch (error: any) {
            console.error(`[GoogleDriveService.uploadFile] Error for Tenant ${tenantId}:`, error);
            logDetails.error = error.message || String(error);
            return { success: false, error: logDetails.error, fileName: file.originalname };
        } finally {
            await logIntegration(tenantId, 'GoogleDrive', action, status, logDetails);
        }
    }

    async createFolderStructure(
        tenantId: string,
        name: string,
        _parentIdentifier?: string
    ): Promise<CreateFolderResult & { categoryFolders?: Record<string, string> }> {
        const action = 'CREATE_FOLDER';
        let status: 'SUCCESS' | 'ERROR' = 'ERROR';
        let logDetails: any = { baseName: name };

        try {
            // Note: Este método deve ser chamado no router após criar o Empreendimento no DB
            throw new Error("createFolderStructure deve ser chamado após criação do Empreendimento no DB.");
        } catch (error: any) {
            console.error(`[GoogleDriveService.createFolderStructure] Error for Tenant ${tenantId}:`, error);
            logDetails.error = error.message || String(error);
            return { success: false, error: logDetails.error };
        } finally {
            // Log comentado pois deve ocorrer no router
            // await logIntegration(tenantId, 'GoogleDrive', action, status, logDetails);
        }
    }

    async deleteFileOrResource(
        tenantId: string,
        fileId: string
    ): Promise<{ success: boolean; error?: string }> {
        const action = 'DELETE';
        let status: 'SUCCESS' | 'ERROR' = 'ERROR';
        let logDetails: any = { fileId };

        try {
            const result = await libDeleteFileFromDrive(tenantId, fileId);
            logDetails = { ...logDetails, ...result };

            if (result.success) {
                status = 'SUCCESS';
                return result;
            } else {
                throw new Error(result.error || 'Unknown error deleting Drive file');
            }
        } catch (error: any) {
            console.error(`[GoogleDriveService.deleteFileOrResource] Error for Tenant ${tenantId}, File ${fileId}:`, error);
            logDetails.error = error.message || String(error);
            return { success: false, error: logDetails.error };
        } finally {
            await logIntegration(tenantId, 'GoogleDrive', action, status, logDetails);
        }
    }

    // Métodos não aplicáveis ao Google Drive
    async addRow?(
        _tenantId: string,
        _resourceIdentifier: string,
        _data: any[],
        _options?: Record<string, any>
    ): Promise<SyncResult> {
        throw new Error("Method not applicable for Google Drive.");
    }

    async updateRow?(
        _tenantId: string,
        _resourceIdentifier: string,
        _uniqueRowId: string,
        _data: any[],
        _options?: Record<string, any>
    ): Promise<SyncResult> {
        throw new Error("Method not applicable for Google Drive.");
    }
}