// server/api/schemas/backup.ts
import { z } from 'zod';

/**
 * Schemas para validação de dados relacionados a Backups (tRPC)
 */

// Schema para input da criação de backup (opcional, pode ser vazio)
export const createBackupSchema = z.object({
  // Adicione opções aqui se necessário, ex:
  // includeUsers: z.boolean().default(true),
  // specificCollections: z.array(z.string()).optional(),
}).optional();

// Schema para a RESPOSTA da procedure que GERA o CSV para download
export const generateCsvResponseSchema = z.object({
  success: z.boolean(),
  csvContent: z.string().optional(), // O conteúdo CSV completo como string
  fileName: z.string().optional(),   // Nome sugerido para o arquivo (ex: backup_20231027_103000.csv)
  message: z.string(),             // Mensagem de sucesso ou erro
  error: z.string().optional(),      // Detalhes do erro, se houver
});
export type GenerateCsvResponse = z.infer<typeof generateCsvResponseSchema>;

// Schema para a RESPOSTA da procedure que salva no Drive (PLACEHOLDER)
export const saveToDriveResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    driveFileId: z.string().optional(), // ID do arquivo criado no Drive
    error: z.string().optional(),
});
export type SaveToDriveResponse = z.infer<typeof saveToDriveResponseSchema>;

// Schema de resposta para a mutação `create` original (se for mantida genericamente)
export const createBackupResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    filePath: z.string().optional(), // Exemplo se salvasse em S3/local no server
    error: z.string().optional(),
});
export type CreateBackupResponse = z.infer<typeof createBackupResponseSchema>;