// server/api/schemas/upload.ts
import { z } from 'zod';

// Schema para input do upload S3 (espera base64)
export const s3UploadSchema = z.object({
  fileName: z.string().trim().min(1, { message: 'Nome do arquivo é obrigatório' }),
  mimeType: z.string().trim().min(1, { message: 'Tipo MIME é obrigatório' }),
  content: z.string().min(1, { message: 'Conteúdo (base64) é obrigatório' })
    .refine(content => /^[A-Za-z0-9+/=]+$/.test(content.replace(/\s/g, '')), { message: "Conteúdo base64 inválido"}),
});
export type S3UploadInput = z.infer<typeof s3UploadSchema>;

// Schema para resposta do upload S3
export const s3UploadResponseSchema = z.object({
    success: z.boolean(),
    fileName: z.string().optional(),
    url: z.string().url().optional(),
    message: z.string(),
    error: z.string().optional(), // Incluir campo de erro opcional
});
export type S3UploadResponse = z.infer<typeof s3UploadResponseSchema>;