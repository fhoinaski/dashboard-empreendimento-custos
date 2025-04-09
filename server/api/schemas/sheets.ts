import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados de integração com Google Sheets (tRPC)
 */

// Schema para criação de planilha para empreendimento
export const createSheetSchema = z.object({
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }),
  // O nome é buscado no backend a partir do ID
});
export type CreateSheetInput = z.infer<typeof createSheetSchema>;

// Schema para a resposta da criação da planilha
export const createSheetResponseSchema = z.object({
    success: z.boolean(),
    sheetId: z.string().optional(),
    url: z.string().url().optional(),
    message: z.string(),
    error: z.string().optional(),
});
export type CreateSheetResponse = z.infer<typeof createSheetResponseSchema>;

// Schema para adicionar linha (exemplo genérico)
export const addRowToSheetSchema = z.object({
    sheetId: z.string().min(1, { message: 'ID da planilha é obrigatório' }),
    rowData: z.array(z.any()),
});
export type AddRowToSheetInput = z.infer<typeof addRowToSheetSchema>;