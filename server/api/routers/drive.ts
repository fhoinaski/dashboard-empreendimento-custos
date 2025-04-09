
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createDriveFolderSchema,
    listDriveFilesSchema,
    listDriveFilesResponseSchema,
    driveUploadDespesaSchema,    // Schema específico para anexo de despesa
    driveUploadAnexoResponseSchema, // Schema de resposta para anexo de despesa
    driveFileSchema             // Importar driveFileSchema se for usar na resposta de listFiles
} from '../schemas/drive';
// Corrigir importação do tipo Attachment - deve vir de onde é definido (schemas/despesas)
import type { Attachment } from '../schemas/despesas';
import { Empreendimento, Despesa, Documento, DespesaDocument } from '@/lib/db/models';
import connectToDatabase from '@/lib/db/mongodb';
import mongoose, { Types } from 'mongoose';
import {
    createEmpreendimentoFolders,
    uploadFileToDrive,
    listFilesInFolder,
    deleteFileFromDrive,
    getDriveClient
} from '@/lib/google/drive';

/**
 * Roteador para Google Drive
 * Gerencia rotas relacionadas à integração com Google Drive
 */
export const driveRouter = router({
  // Criar estrutura de pastas para empreendimento no Drive (Admin only)
  createEmpreendimentoFolders: adminProcedure
    .input(createDriveFolderSchema)
    // Opcional: Adicionar output schema para padronização
    .mutation(async ({ input, ctx }) => {
       console.log("[tRPC drive.createEmpreendimentoFolders] Input:", input);
      try {
        await connectToDatabase();
        const empreendimento = await Empreendimento.findById(input.empreendimentoId);
        if (!empreendimento) {
             console.error(`[tRPC drive.createEmpreendimentoFolders] Empreendimento não encontrado: ${input.empreendimentoId}`);
             throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' });
        }
        if (empreendimento.folderId) {
             console.warn(`[tRPC drive.createEmpreendimentoFolders] Empreendimento ${input.empreendimentoId} já possui folderId: ${empreendimento.folderId}`);
             throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empreendimento já possui estrutura de pastas no Drive.' });
        }

         console.log(`[tRPC drive.createEmpreendimentoFolders] Chamando lib para criar pastas para: ${empreendimento.name}`);
        const result = await createEmpreendimentoFolders(input.empreendimentoId, empreendimento.name);

        if (!result.success || !result.empreendimentoFolderId) {
           console.error(`[tRPC drive.createEmpreendimentoFolders] Erro na lib createEmpreendimentoFolders: ${result.error}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Falha ao criar pastas no Google Drive',
          });
        }
         console.log(`[tRPC drive.createEmpreendimentoFolders] Pastas criadas. FolderId: ${result.empreendimentoFolderId}`);

        // Atualizar o empreendimento no DB com o folderId
         console.log(`[tRPC drive.createEmpreendimentoFolders] Atualizando empreendimento ${input.empreendimentoId} no DB com folderId.`);
        await Empreendimento.findByIdAndUpdate(input.empreendimentoId, { folderId: result.empreendimentoFolderId });

        return {
          success: true,
          folderId: result.empreendimentoFolderId,
          categoryFolders: result.categoryFolders, // Inclui IDs das subpastas
          message: 'Estrutura de pastas criada com sucesso no Google Drive.',
        };
      } catch (error) {
        console.error('[tRPC drive.createEmpreendimentoFolders] Erro:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao criar estrutura de pastas no Drive',
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  // Fazer upload de ANEXO DE DESPESA para o Drive
  uploadDespesaAnexo: protectedProcedure // Permissão verificada abaixo
    .input(driveUploadDespesaSchema) // Schema específico para anexo de despesa
    .output(driveUploadAnexoResponseSchema) // Schema de resposta específico
    .mutation(async ({ input, ctx }) => {
       console.log(`[tRPC drive.uploadDespesaAnexo] Upload para Despesa: ${input.despesaId}, Empr: ${input.empreendimentoId}, Arquivo: ${input.fileName}`);

      try {
        await connectToDatabase();

        // 1. Encontrar Empreendimento e Despesa
        const [empreendimento, despesa] = await Promise.all([
          Empreendimento.findById(input.empreendimentoId).select('folderId name').lean(),
          // Buscar o documento completo para poder usar .save() depois
          Despesa.findById(input.despesaId)
        ]);

        if (!empreendimento) {
           console.error(`[tRPC uploadDespesaAnexo] Empreendimento não encontrado: ${input.empreendimentoId}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: `Empreendimento ${input.empreendimentoId} não encontrado.` });
        }
        if (!despesa) {
           console.error(`[tRPC uploadDespesaAnexo] Despesa não encontrada: ${input.despesaId}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: `Despesa ${input.despesaId} não encontrada.` });
        }
        if (!empreendimento.folderId) {
           console.error(`[tRPC uploadDespesaAnexo] Empreendimento ${empreendimento.name} não possui folderId configurado.`);
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Empreendimento ${empreendimento.name} não possui pasta configurada no Drive.` });
        }
        console.log(`[tRPC uploadDespesaAnexo] Empreendimento ${empreendimento.name} (Folder: ${empreendimento.folderId}) e Despesa ${despesa._id} encontrados.`);

        // 2. Verificar Permissão
        const isCreator = despesa.createdBy.equals(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';
        const canUpload = isAdmin || isCreator; // Exemplo: Admin ou o criador podem anexar
        if (!canUpload) {
             console.warn(`[tRPC uploadDespesaAnexo] Usuário ${ctx.user.id} (${ctx.user.role}) sem permissão para anexar à despesa ${input.despesaId}. Criador: ${despesa.createdBy}`);
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para anexar a esta despesa.' });
        }
        console.log(`[tRPC uploadDespesaAnexo] Permissão concedida para ${ctx.user.role}.`);

        // 3. Preparar e Validar Arquivo
        const buffer = Buffer.from(input.content, 'base64');
        const fileData = { buffer, originalname: input.fileName, mimetype: input.mimeType };
        console.log(`[tRPC uploadDespesaAnexo] Dados do arquivo: mimetype=${fileData.mimetype}, size=${fileData.buffer.length} bytes`);

        // Validações (pode usar refine no schema também)
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (!allowedTypes.includes(fileData.mimetype)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `Tipo de arquivo inválido: ${fileData.mimetype}` });
        }
        if (fileData.buffer.length > maxSize) {
            throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `Arquivo excede o limite de ${(maxSize / 1024 / 1024).toFixed(1)}MB` });
        }
        console.log(`[tRPC uploadDespesaAnexo] Validação OK.`);

        // 4. Fazer Upload para o Drive (usando folderId do empreendimento e categoria)
        console.log(`[tRPC uploadDespesaAnexo] Chamando uploadFileToDrive com folderId: ${empreendimento.folderId}, category: ${input.category}`);
        const uploadResult = await uploadFileToDrive(fileData, empreendimento.folderId, input.category);
        console.log("[tRPC uploadDespesaAnexo] Resultado da lib uploadFileToDrive:", uploadResult);

        if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
          console.error(`[tRPC uploadDespesaAnexo] Erro na lib uploadFileToDrive: ${uploadResult.error}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: uploadResult.error || 'Falha ao fazer upload do anexo para o Google Drive',
          });
        }

        // 5. Atualizar a Despesa no Banco com o Anexo
        // --- CORREÇÃO APLICADA: Remover anotação de tipo explícita ---
        const newAttachment = {
          fileId: uploadResult.fileId,
          name: uploadResult.fileName,
          url: uploadResult.webViewLink, // Usar webViewLink
        };
        // --- FIM DA CORREÇÃO ---

        // Adiciona ou substitui o anexo (lógica atual substitui)
        despesa.attachments = [newAttachment]; // Atribui o objeto simples inferido
        despesa.updatedAt = new Date(); // Atualiza timestamp
        await despesa.save();
        console.log(`[tRPC uploadDespesaAnexo] Despesa ${input.despesaId} atualizada no DB com anexo: ${uploadResult.fileId}`);

        // 6. Retornar sucesso validado pelo schema
        return driveUploadAnexoResponseSchema.parse({
          success: true,
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName,
          url: uploadResult.webViewLink,
          message: 'Anexo enviado e vinculado à despesa com sucesso.',
        });

      } catch (error) {
        console.error('[tRPC drive.uploadDespesaAnexo] Erro:', error);
        if (error instanceof TRPCError) throw error;
        // Retorna erro validado pelo schema
        return driveUploadAnexoResponseSchema.parse({
           success: false,
           message: 'Erro interno ao processar anexo da despesa',
           error: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  // Listar arquivos em uma pasta do Drive (Admin/Manager only?)
  listFiles: protectedProcedure // Permissão checada internamente
    .input(listDriveFilesSchema)
    .output(listDriveFilesResponseSchema)
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores e gerentes.' });
      }
      console.log(`[tRPC drive.listFiles] Listando arquivos para Folder ID: ${input.folderId} por ${ctx.user.id} (${ctx.user.role})`);

      try {
        const result = await listFilesInFolder(input.folderId);
        if (!result.success || !result.files) {
            console.error(`[tRPC drive.listFiles] Erro na lib listFilesInFolder: ${result.error}`);
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || 'Falha ao listar arquivos da pasta.' });
        }
        console.log(`[tRPC drive.listFiles] Encontrados ${result.files.length} arquivos.`);

        // Mapear e filtrar resultado
        const clientFiles = result.files
            .filter(file => file?.id && file.mimeType !== 'application/vnd.google-apps.folder') // Filtra pastas e inválidos
            .map(file => ({
                id: file.id!,
                name: file.name || 'Sem nome',
                mimeType: file.mimeType || 'application/octet-stream',
                webViewLink: file.webViewLink || undefined,
                webContentLink: file.webContentLink || undefined,
                createdTime: file.createdTime || undefined,
                size: file.size || undefined,
            }));

        // Validar o output antes de retornar
        return listDriveFilesResponseSchema.parse({ files: clientFiles });

      } catch (error) {
        console.error('[tRPC drive.listFiles] Erro:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao listar arquivos da pasta do Drive',
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }),

    // --- Manter uploadToS3 se ainda for necessário em outro lugar ---
    uploadToS3: protectedProcedure
        .input(z.object({ /* Schema S3 */ fileName: z.string(), mimeType: z.string(), content: z.string() })) // Usar schema correto importado se existir
        .mutation(async ({ input, ctx }) => {
            // Simulação ou lógica real do S3
            console.log("Upload S3 chamado (simulação/real)");
            await new Promise(res=>setTimeout(res, 500));
            // Idealmente usar schema de resposta S3 aqui também
            return { success: true, fileName: input.fileName, url: `https://fake-s3-bucket.s3.amazonaws.com/${Date.now()}-${input.fileName}`, message: "Upload S3 OK" };
        }),
});

export type DriveRouter = typeof driveRouter;