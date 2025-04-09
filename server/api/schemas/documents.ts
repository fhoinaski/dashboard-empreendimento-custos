import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados de documentos (tRPC)
 */

// Schema para criação de documento (recebe IDs/URLs do storage)
export const createDocumentoSchema = z.object({
  name: z.string().trim().min(2, { message: 'O nome deve ter pelo menos 2 caracteres' }),
  type: z.string().trim().min(1, { message: 'Tipo MIME do documento é obrigatório' }),
  empreendimento: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  category: z.string().default('Outros'),
  fileId: z.string().trim().min(1, { message: 'ID do arquivo (Drive/S3) é obrigatório' }),
  url: z.string().url({ message: "URL inválida" }).optional(),
  // createdBy é adicionado pelo contexto
});
export type CreateDocumentoInput = z.infer<typeof createDocumentoSchema>;

// Schema para filtros da lista de documentos
export const documentFilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});
export type DocumentFilterInput = z.infer<typeof documentFilterSchema>;

// Schema para resposta de documento individual
export const documentResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  type: z.string(),
  empreendimento: z.object({
    _id: z.string(),
    name: z.string(),
  }),
  category: z.string(),
  fileId: z.string(),
  url: z.string().url().optional().nullable(),
  createdBy: z.object({
    _id: z.string(),
    name: z.string(),
  }).optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentoResponse = z.infer<typeof documentResponseSchema>;

// Schema para resposta da lista de documentos
export const documentListResponseSchema = z.object({
    documents: z.array(documentResponseSchema),
    pagination: z.object({
        total: z.number().int().min(0),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().min(0),
        hasMore: z.boolean(),
    })
});
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

// Schema para exclusão de documento
export const deleteDocumentoSchema = z.object({
  id: z.string().refine(id => mongoose.isValidObjectId(id), { message: 'ID de documento inválido' }),
});
export type DeleteDocumentoInput = z.infer<typeof deleteDocumentoSchema>;