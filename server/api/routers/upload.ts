import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { s3UploadSchema, s3UploadResponseSchema } from'../schemas/upload'; // Import Schemas
import { uploadFileToS3 } from '@/lib/s3'; // Import S3 helper

/**
 * Roteador para uploads genéricos (S3)
 * Gerencia rotas relacionadas ao upload de arquivos para S3
 */
export const uploadRouter = router({
  // Fazer upload para S3 (Equivalente a POST /api/upload-s3)
  uploadToS3: protectedProcedure // Allow any authenticated user? Or restrict further?
    .input(s3UploadSchema) // Use the schema expecting base64 content
    .output(s3UploadResponseSchema) // Validate the response
    .mutation(async ({ input, ctx }) => {
       // Optional: Add role check if only specific roles can upload
       // if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
       //    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito.' });
       // }
       console.log(`[tRPC upload.uploadToS3] Upload iniciado por ${ctx.user.id}. Arquivo: ${input.fileName}, Tipo: ${input.mimeType}`);

      try {
        const buffer = Buffer.from(input.content, 'base64');
        const bucketName = process.env.AWS_S3_BUCKET_NAME;

        if (!bucketName) {
           console.error("[tRPC upload.uploadToS3] AWS_S3_BUCKET_NAME não configurado!");
           throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro de configuração do servidor (S3).' });
        }

         // Basic validation (consider adding size/type checks to schema with refine)
         const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
         const maxSize = 10 * 1024 * 1024; // 10MB
         if (!allowedTypes.includes(input.mimeType)) {
             throw new TRPCError({ code: 'BAD_REQUEST', message: `Tipo de arquivo inválido: ${input.mimeType}. Permitidos: ${allowedTypes.join(', ')}` });
         }
         if (buffer.length > maxSize) {
             throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: `Arquivo excede o limite de ${(maxSize / 1024 / 1024).toFixed(1)}MB` });
         }
          console.log(`[tRPC upload.uploadToS3] Validação OK. Tamanho: ${buffer.length} bytes.`);
          console.log(`[tRPC upload.uploadToS3] Chamando uploadFileToS3 para bucket: ${bucketName}`);

        const uploadResult = await uploadFileToS3(
          { buffer, originalname: input.fileName, mimetype: input.mimeType },
          bucketName
        );
        console.log("[tRPC upload.uploadToS3] Resultado da lib uploadFileToS3:", uploadResult);

        if (!uploadResult.success || !uploadResult.url) {
          console.error('[tRPC upload.uploadToS3] Falha no upload S3:', uploadResult.error);
          // Throw specific error based on result
          throw new TRPCError({
             code: 'INTERNAL_SERVER_ERROR',
             message: uploadResult.error || 'Erro desconhecido ao fazer upload para o S3'
          });
        }

         console.log(`[tRPC upload.uploadToS3] Upload S3 bem-sucedido. URL: ${uploadResult.url}`);
        // Validate and return response
         return s3UploadResponseSchema.parse({
            success: true,
            fileName: uploadResult.fileName,
            url: uploadResult.url,
            message: 'Arquivo enviado para S3 com sucesso',
         });

      } catch (error) {
        console.error('[tRPC upload.uploadToS3] Erro:', error);
        if (error instanceof TRPCError) throw error; // Relança erros TRPC
        // Return structured error response matching the schema
         return s3UploadResponseSchema.parse({
            success: false,
            message: 'Erro interno ao processar o upload',
            error: error instanceof Error ? error.message : String(error),
         });
         // OR: throw a generic TRPCError
         // throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno ao processar o upload' });
      }
    }),
});

export type UploadRouter = typeof uploadRouter;