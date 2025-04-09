// server/api/schemas/drive.ts
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados de integração com Google Drive (tRPC)
 */

// --- Schema para Criação de Pasta de Empreendimento ---
export const createDriveFolderSchema = z.object({
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  // O nome é buscado no backend a partir do ID, não precisa vir no input.
});
export type CreateDriveFolderInput = z.infer<typeof createDriveFolderSchema>;

// Schema para Resposta da Criação de Pasta
export const createDriveFolderResponseSchema = z.object({
    success: z.boolean(),
    folderId: z.string().optional(), // Tornar opcional em caso de erro
    categoryFolders: z.record(z.string(), z.string()).optional(), // Opcional em caso de erro
    message: z.string(),
    error: z.string().optional(), // Adicionar campo de erro
});
export type CreateDriveFolderResponse = z.infer<typeof createDriveFolderResponseSchema>;


// --- Schema para Upload GENÉRICO de Arquivo no Drive (se necessário) ---
// Este schema pode ser usado para uploads que não estão diretamente ligados a uma despesa.
export const driveGenericUploadSchema = z.object({
  fileName: z.string().trim().min(1, { message: 'Nome do arquivo é obrigatório' }),
  mimeType: z.string().trim().min(1, { message: 'Tipo MIME é obrigatório' }),
  // ID da pasta PAI (pode ser a raiz do empreendimento ou uma subpasta específica)
  folderId: z.string().trim().min(1, { message: 'ID da pasta pai é obrigatório' }),
  // Categoria é útil para organizar dentro da pasta pai
  category: z.string().trim().min(1, { message: 'Categoria (subpasta) é obrigatória' }),
  // Conteúdo do arquivo
  content: z.string().min(1, { message: 'Conteúdo do arquivo (base64) é obrigatório' })
    .refine(content => /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, '')), { message: "Conteúdo base64 inválido"}),
  // Opcional: Vincular a um empreendimento para salvar referência no schema 'Documento'
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido para salvar referência",
  }).optional(),
  // Flag para indicar se deve salvar no schema 'Documento'
  saveReference: z.boolean().default(true),
});
export type DriveGenericUploadInput = z.infer<typeof driveGenericUploadSchema>;

// Schema para Resposta do Upload Genérico
export const driveGenericUploadResponseSchema = z.object({
    success: z.boolean(),
    fileId: z.string().optional(),
    fileName: z.string().optional(),
    url: z.string().url("URL inválida").optional(), // webViewLink
    message: z.string(),
    documentId: z.string().optional(), // ID do documento criado no DB (se saveReference=true)
    error: z.string().optional(),
});
export type DriveGenericUploadResponse = z.infer<typeof driveGenericUploadResponseSchema>;


// --- Schema para Upload de ANEXO DE DESPESA ---
// Input específico para anexos de despesas.
export const driveUploadDespesaSchema = z.object({
  fileName: z.string().trim().min(1, { message: 'Nome do arquivo é obrigatório' }),
  mimeType: z.string().trim().min(1, { message: 'Tipo MIME é obrigatório' }),
  // ID do Empreendimento é obrigatório para buscar o folderId e vincular
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  // Categoria da subpasta (default 'Despesas')
  category: z.string().trim().default('Despesas'),
  // Conteúdo do arquivo
  content: z.string().min(1, { message: 'Conteúdo do arquivo (base64) é obrigatório' })
    .refine(content => /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, '')), { message: "Conteúdo base64 inválido"}),
  // ID da Despesa é obrigatório para vincular o anexo
  despesaId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID da despesa inválido",
  }),
  // folderId não precisa vir no input, buscamos pelo empreendimentoId
});
export type DriveUploadDespesaInput = z.infer<typeof driveUploadDespesaSchema>;

// Schema para Resposta do Upload de Anexo de Despesa
export const driveUploadAnexoResponseSchema = z.object({
    success: z.boolean(),
    fileId: z.string().optional(),
    fileName: z.string().optional(),
    url: z.string().url("URL inválida").optional(), // webViewLink
    message: z.string(),
    error: z.string().optional(),
});
export type DriveUploadAnexoResponse = z.infer<typeof driveUploadAnexoResponseSchema>;


// --- Schema para Listar Arquivos em uma Pasta ---
export const listDriveFilesSchema = z.object({
  folderId: z.string().trim().min(1, { message: 'ID da pasta é obrigatório' }),
  // Opcional: Adicionar filtros de busca, tipo, etc., se necessário no futuro
  // searchTerm: z.string().optional(),
  // mimeType: z.string().optional(),
});
export type ListDriveFilesInput = z.infer<typeof listDriveFilesSchema>;

// Schema para o objeto de arquivo individual retornado pela API do Drive
export const driveFileSchema = z.object({
    id: z.string(),
    name: z.string(),
    mimeType: z.string(),
    webViewLink: z.string().url("URL inválida").optional().nullable(),
    webContentLink: z.string().url("URL inválida").optional().nullable(),
    createdTime: z.string().datetime("Data de criação inválida").optional().nullable(),
    size: z.string().optional().nullable(), // Tamanho vem como string da API do Drive
});
export type DriveFile = z.infer<typeof driveFileSchema>;

// Schema para a Resposta da Listagem de Arquivos
export const listDriveFilesResponseSchema = z.object({
    files: z.array(driveFileSchema),
    // Opcional: Adicionar paginação se a API do Drive suportar/necessário
    // nextPageToken: z.string().optional(),
});
export type ListDriveFilesResponse = z.infer<typeof listDriveFilesResponseSchema>;


// --- Schema para Exclusão de Arquivo (Exemplo) ---
export const deleteDriveFileSchema = z.object({
    fileId: z.string().min(1, "ID do arquivo é obrigatório"),
    // Opcional: IDs para remover referência no DB
    // documentId: z.string().optional(),
    // despesaId: z.string().optional(),
});
export type DeleteDriveFileInput = z.infer<typeof deleteDriveFileSchema>;