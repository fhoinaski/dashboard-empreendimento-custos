import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

export const getDriveClient = () => {
  const auth = new JWT({
    email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};

export async function createEmpreendimentoFolders(empreendimentoId: string, empreendimentoName: string) {
  const drive = getDriveClient();
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) throw new Error('ID da pasta raiz não configurado');

    const empreendimentoFolder = await drive.files.create({
      requestBody: { name: `${empreendimentoName} - ${empreendimentoId}`, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] },
    });
    const empreendimentoFolderId = empreendimentoFolder.data.id;

    const categories = ['Documentos Jurídicos', 'Plantas e Projetos', 'Financeiro', 'Contratos', 'Fotos', 'Relatórios', 'Despesas', 'Outros'];
    const subfolders = await Promise.all(
      categories.map(async (category) => {
        const folder = await drive.files.create({
          requestBody: { name: category, mimeType: 'application/vnd.google-apps.folder', parents: [empreendimentoFolderId!] },
        });
        return { category, folderId: folder.data.id };
      })
    );

    const categoryFolders = subfolders.reduce((map: Record<string, string>, folder) => {
      map[folder.category] = folder.folderId!;
      return map;
    }, {});

    return { success: true, empreendimentoFolderId, categoryFolders };
  } catch (error) {
    console.error('Erro ao criar pastas no Drive:', error);
    return { success: false, error: 'Falha ao criar pastas no Google Drive' };
  }
}

export async function getCategoryFolderId(drive: any, empreendimentoFolderId: string, category: string) {
  try {
    // Buscar a subpasta correspondente à categoria
    const response = await drive.files.list({
      q: `'${empreendimentoFolderId}' in parents and name = '${category}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
    });

    const files = response.data.files || [];
    if (files.length > 0) {
      return files[0].id; // Retorna o ID da subpasta existente
    }

    // Se a subpasta não existir, criá-la
    const subFolderMetadata = {
      name: category,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [empreendimentoFolderId],
    };

    const subFolderResponse = await drive.files.create({
      requestBody: subFolderMetadata,
      fields: 'id',
    });

    return subFolderResponse.data.id;
  } catch (error) {
    console.error(`Erro ao buscar/criar subpasta para a categoria ${category}:`, error);
    throw new Error(`Erro ao buscar/criar subpasta para a categoria ${category}`);
  }
}

export async function uploadFileToDrive(file: { buffer: Buffer, originalname: string, mimetype: string }, folderId: string, category: string, retries = 2) {
  const drive = getDriveClient();
  try {
    // Determinar a pasta de destino com base na categoria
    const targetFolderId = await getCategoryFolderId(drive, folderId, category);

    const fileStream = new Readable();
    fileStream.push(file.buffer);
    fileStream.push(null);

    const response = await drive.files.create({
      requestBody: { name: file.originalname, parents: [targetFolderId] },
      media: { mimeType: file.mimetype, body: fileStream },
      fields: 'id, webViewLink, webContentLink',
    });

    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const fileInfo = await drive.files.get({
      fileId: response.data.id!,
      fields: 'id, webViewLink, webContentLink',
    });

    // URL direta para exibição da imagem
    const directLink = `https://drive.google.com/uc?export=view&id=${response.data.id}`;

    return {
      success: true,
      fileId: response.data.id,
      fileName: file.originalname,
      webViewLink: fileInfo.data.webViewLink,
      webContentLink: fileInfo.data.webContentLink,
      url: directLink,
    };
  } catch (error) {
    console.error('Erro ao fazer upload do arquivo:', error);
    if (retries > 0) return uploadFileToDrive(file, folderId, category, retries - 1);
    return { success: false, error: 'Falha ao fazer upload do arquivo para o Google Drive' };
  }
}

export async function getFileFromDrive(fileId: string) {
  const drive = getDriveClient();
  try {
    const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    return { success: true, stream: file.data };
  } catch (error) {
    console.error('Erro ao obter arquivo do Drive:', error);
    return { success: false, error: 'Falha ao obter arquivo do Google Drive' };
  }
}

export async function deleteFileFromDrive(fileId: string) {
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId });
    return { success: true };
  } catch (error) {
    console.error('Erro ao excluir arquivo do Drive:', error);
    return { success: false, error: 'Falha ao excluir arquivo do Google Drive' };
  }
}

export async function listFilesInFolder(folderId: string) {
  const drive = getDriveClient();
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, size)',
    });
    return { success: true, files: response.data.files };
  } catch (error) {
    console.error('Erro ao listar arquivos na pasta:', error);
    return { success: false, error: 'Falha ao listar arquivos na pasta do Google Drive' };
  }
}