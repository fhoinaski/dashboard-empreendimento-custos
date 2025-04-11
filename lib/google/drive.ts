// FILE: lib/google/drive.ts (Integrado e Refatorado)
// ============================================================
import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { AppSettings } from '@/lib/db/models';
import { decrypt } from '@/lib/crypto';

// Interface para credenciais do serviço
interface ServiceAccountCredentials {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain?: string;
}

// Função auxiliar para obter credenciais do tenant
async function getTenantGoogleCredentials(tenantId: string | mongoose.Types.ObjectId): Promise<ServiceAccountCredentials | null> {
    if (!mongoose.isValidObjectId(tenantId)) {
        console.error(`[Drive] getTenantGoogleCredentials: ID de Tenant inválido: ${tenantId}`);
        return null;
    }

    console.log(`[Drive] getTenantGoogleCredentials: Buscando credenciais para Tenant ID: ${tenantId}`);
    try {
        const settings = await AppSettings.findOne({ tenantId: new mongoose.Types.ObjectId(tenantId) })
            .select('googleDriveEnabled googleServiceAccountJsonEncrypted')
            .lean();

        if (!settings || !settings.googleDriveEnabled || !settings.googleServiceAccountJsonEncrypted) {
            console.log(`[Drive] getTenantGoogleCredentials: Drive desabilitado ou JSON não configurado para Tenant: ${tenantId}`);
            return null;
        }

        const decryptedJson = await decrypt(settings.googleServiceAccountJsonEncrypted);
        if (!decryptedJson) {
            console.error(`[Drive] getTenantGoogleCredentials: Falha ao decriptar JSON para Tenant ID: ${tenantId}`);
            return null;
        }

        const credentials = JSON.parse(decryptedJson);
        if (!credentials.client_email || !credentials.private_key) {
            console.error(`[Drive] getTenantGoogleCredentials: JSON decriptado inválido (faltam campos) para Tenant ${tenantId}`);
            return null;
        }

        console.log(`[Drive] getTenantGoogleCredentials: Credenciais obtidas para Tenant: ${tenantId}`);
        return credentials as ServiceAccountCredentials;
    } catch (error) {
        console.error(`[Drive] getTenantGoogleCredentials: Erro ao obter credenciais para Tenant ID ${tenantId}:`, error);
        return null;
    }
}

// Função para criar cliente Drive para um tenant
export async function getDriveClientForTenant(tenantId: string | mongoose.Types.ObjectId): Promise<drive_v3.Drive | null> {
    const credentials = await getTenantGoogleCredentials(tenantId);
    if (!credentials) {
        console.error(`[Drive] getDriveClientForTenant: Credenciais não disponíveis para Tenant: ${tenantId}`);
        return null;
    }

    try {
        const jwtClient = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        console.log(`[Drive] getDriveClientForTenant: Cliente JWT Drive criado para Tenant: ${tenantId}`);
        return google.drive({ version: 'v3', auth: jwtClient });
    } catch (authError) {
        console.error(`[Drive] getDriveClientForTenant: Erro ao criar cliente JWT Drive para Tenant ${tenantId}:`, authError);
        return null;
    }
}

// Criar pastas para empreendimento
export async function createEmpreendimentoFolders(tenantId: string, empreendimentoId: string, empreendimentoName: string) {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] createEmpreendimentoFolders: Integração Drive não configurada para Tenant: ${tenantId}`);
        return { success: false, error: 'Integração Google Drive não configurada ou habilitada.' };
    }

    console.log(`[Drive] createEmpreendimentoFolders: Iniciando para Tenant ${tenantId}, Empr. ID ${empreendimentoId}, Nome: ${empreendimentoName}`);
    try {
        const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
        if (!rootFolderId) {
            console.error(`[Drive] createEmpreendimentoFolders: GOOGLE_DRIVE_ROOT_FOLDER_ID não definido`);
            throw new Error('ID da pasta raiz não configurado');
        }

        const empFolderName = `${empreendimentoName} - ${empreendimentoId.slice(-6)}`;
        const empreendimentoFolder = await drive.files.create({
            requestBody: { name: empFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
            fields: 'id',
        });

        const empreendimentoFolderId = empreendimentoFolder.data.id;
        if (!empreendimentoFolderId) {
            console.error(`[Drive] createEmpreendimentoFolders: Falha ao criar pasta principal para Tenant: ${tenantId}`);
            throw new Error('Falha ao criar pasta principal');
        }

        const categories = ['Documentos Jurídicos', 'Plantas e Projetos', 'Financeiro', 'Contratos', 'Fotos', 'Relatórios', 'Despesas', 'Outros'];
        const subfolders = await Promise.all(
            categories.map(async (category) => {
                try {
                    const folder = await drive.files.create({
                        requestBody: { name: category, mimeType: 'application/vnd.google-apps.folder', parents: [empreendimentoFolderId] },
                        fields: 'id',
                    });
                    return { category, folderId: folder.data.id };
                } catch (subError) {
                    console.error(`[Drive] createEmpreendimentoFolders: Falha ao criar subpasta '${category}' para Tenant ${tenantId}:`, subError);
                    return { category, folderId: null };
                }
            })
        );

        const categoryFolders = subfolders.reduce((map: Record<string, string>, folder) => {
            if (folder.folderId) map[folder.category] = folder.folderId;
            return map;
        }, {});

        console.log(`[Drive] createEmpreendimentoFolders: Pastas criadas com sucesso para Tenant: ${tenantId}`);
        return { success: true, empreendimentoFolderId, categoryFolders };
    } catch (error: any) {
        console.error(`[Drive] createEmpreendimentoFolders: Erro para Tenant ${tenantId}, Empr ${empreendimentoId}:`, error);
        return { success: false, error: `Falha ao criar pastas: ${error.message || 'Erro desconhecido'}` };
    }
}

// Obter ou criar ID da pasta de categoria
export async function getCategoryFolderId(tenantId: string, empreendimentoFolderId: string, category: string): Promise<string | null> {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] getCategoryFolderId: Cliente Drive não disponível para Tenant: ${tenantId}`);
        return null;
    }

    console.log(`[Drive] getCategoryFolderId: Buscando/criando pasta '${category}' para Tenant ${tenantId}, EmprFolder ${empreendimentoFolderId}`);
    try {
        const response = await drive.files.list({
            q: `'${empreendimentoFolderId}' in parents and name = '${category}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id)',
            pageSize: 1,
        });

        const files = response.data.files || [];
        if (files.length > 0 && files[0].id) {
            console.log(`[Drive] getCategoryFolderId: Pasta '${category}' encontrada: ${files[0].id}`);
            return files[0].id;
        }

        const subFolderResponse = await drive.files.create({
            requestBody: { name: category, mimeType: 'application/vnd.google-apps.folder', parents: [empreendimentoFolderId] },
            fields: 'id',
        });

        if (!subFolderResponse.data.id) {
            console.error(`[Drive] getCategoryFolderId: Falha ao criar subpasta '${category}' para Tenant ${tenantId}`);
            throw new Error(`Falha ao criar subpasta '${category}'`);
        }

        console.log(`[Drive] getCategoryFolderId: Subpasta '${category}' criada: ${subFolderResponse.data.id}`);
        return subFolderResponse.data.id;
    } catch (error: any) {
        console.error(`[Drive] getCategoryFolderId: Erro para Tenant ${tenantId}, EmprFolder ${empreendimentoFolderId}, Categoria '${category}':`, error);
        return null;
    }
}

// Fazer upload de arquivo para o Drive
export async function uploadFileToDrive(
    tenantId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    empreendimentoFolderId: string,
    category: string,
    retries = 2
): Promise<{ success: boolean; fileId?: string; fileName?: string; webViewLink?: string; webContentLink?: string; url?: string; error?: string }> {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] uploadFileToDrive: Integração Drive não configurada para Tenant: ${tenantId}`);
        return { success: false, error: 'Integração Google Drive não configurada ou habilitada.' };
    }

    console.log(`[Drive] uploadFileToDrive: Fazendo upload de '${file.originalname}' para Tenant ${tenantId}, Categoria '${category}'`);
    try {
        const targetFolderId = await getCategoryFolderId(tenantId, empreendimentoFolderId, category);
        if (!targetFolderId) {
            console.error(`[Drive] uploadFileToDrive: Não foi possível obter/criar pasta '${category}' para Tenant ${tenantId}`);
            throw new Error(`Não foi possível obter/criar a pasta '${category}'`);
        }

        const fileStream = new Readable();
        fileStream.push(file.buffer);
        fileStream.push(null);

        const response = await drive.files.create({
            requestBody: { name: file.originalname, parents: [targetFolderId] },
            media: { mimeType: file.mimetype, body: fileStream },
            fields: 'id, webViewLink, webContentLink',
        });

        if (!response.data.id) {
            console.error(`[Drive] uploadFileToDrive: Upload falhou, ID não retornado para Tenant ${tenantId}`);
            throw new Error('Upload falhou, ID não retornado');
        }

        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        const directLink = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
        console.log(`[Drive] uploadFileToDrive: Arquivo '${file.originalname}' enviado com sucesso para Tenant ${tenantId}`);

        return {
            success: true,
            fileId: response.data.id,
            fileName: file.originalname,
            webViewLink: response.data.webViewLink ?? undefined,
            webContentLink: response.data.webContentLink ?? undefined,
            url: directLink,
        };
    } catch (error: any) {
        console.error(`[Drive] uploadFileToDrive: Erro ao fazer upload de '${file.originalname}' para Tenant ${tenantId}:`, error);
        if (retries > 0) {
            console.log(`[Drive] uploadFileToDrive: Tentando novamente (${retries} restantes)`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return uploadFileToDrive(tenantId, file, empreendimentoFolderId, category, retries - 1);
        }
        return { success: false, error: `Falha ao fazer upload: ${error.message || 'Erro desconhecido'}` };
    }
}

// Obter arquivo do Drive
export async function getFileFromDrive(tenantId: string, fileId: string) {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] getFileFromDrive: Integração Drive não configurada para Tenant: ${tenantId}`);
        return { success: false, error: 'Integração Google Drive não configurada ou habilitada.' };
    }

    console.log(`[Drive] getFileFromDrive: Obtendo arquivo ${fileId} para Tenant ${tenantId}`);
    try {
        const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        console.log(`[Drive] getFileFromDrive: Arquivo ${fileId} obtido com sucesso`);
        return { success: true, stream: file.data };
    } catch (error: any) {
        console.error(`[Drive] getFileFromDrive: Erro ao obter arquivo ${fileId} para Tenant ${tenantId}:`, error);
        return { success: false, error: `Falha ao obter arquivo: ${error.message || 'Erro desconhecido'}` };
    }
}

// Excluir arquivo do Drive
export async function deleteFileFromDrive(tenantId: string, fileId: string) {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] deleteFileFromDrive: Integração Drive não configurada para Tenant: ${tenantId}`);
        return { success: false, error: 'Integração Google Drive não configurada ou habilitada.' };
    }

    console.log(`[Drive] deleteFileFromDrive: Excluindo arquivo ${fileId} para Tenant ${tenantId}`);
    try {
        await drive.files.delete({ fileId });
        console.log(`[Drive] deleteFileFromDrive: Arquivo ${fileId} excluído com sucesso`);
        return { success: true };
    } catch (error: any) {
        console.error(`[Drive] deleteFileFromDrive: Erro ao excluir arquivo ${fileId} para Tenant ${tenantId}:`, error);
        return { success: false, error: `Falha ao excluir arquivo: ${error.message || 'Erro desconhecido'}` };
    }
}

// Listar arquivos em uma pasta
export async function listFilesInFolder(tenantId: string, folderId: string) {
    const drive = await getDriveClientForTenant(tenantId);
    if (!drive) {
        console.error(`[Drive] listFilesInFolder: Integração Drive não configurada para Tenant: ${tenantId}`);
        return { success: false, error: 'Integração Google Drive não configurada ou habilitada.', files: [] };
    }

    console.log(`[Drive] listFilesInFolder: Listando arquivos na pasta ${folderId} para Tenant ${tenantId}`);
    try {
        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
            orderBy: 'name',
            pageSize: 100,
        });

        console.log(`[Drive] listFilesInFolder: Arquivos listados com sucesso na pasta ${folderId}`);
        return { success: true, files: response.data.files || [] };
    } catch (error: any) {
        console.error(`[Drive] listFilesInFolder: Erro ao listar arquivos na pasta ${folderId} para Tenant ${tenantId}:`, error);
        return { success: false, error: `Falha ao listar arquivos: ${error.message || 'Erro desconhecido'}`, files: [] };
    }
}
// ============================================================
// FIM DO ARQUIVO INTEGRADO: lib/google/drive.ts
// ============================================================