import { router, adminProcedure } from '../trpc'; // Use adminProcedure for creation
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createSheetSchema } from '../schemas/sheets'; // Import schema
import { createEmpreendimentoSheet } from '@/lib/google/sheets';
import connectToDatabase from '@/lib/db/mongodb'; // Import DB connection
import { Empreendimento } from '@/lib/db/models'; // Import Empreendimento model
import mongoose from 'mongoose';

/**
 * Roteador para Google Sheets
 * Gerencia rotas relacionadas à integração com Google Sheets
 */
export const sheetsRouter = router({
  // Criar planilha para empreendimento (Equivalente a POST /api/sheets/create)
  createEmpreendimentoSheet: adminProcedure
    .input(createSheetSchema) // Use schema with empreendimentoId and empreendimentoName
    .mutation(async ({ input, ctx }) => { // ctx is available
      console.log("[tRPC sheets.createEmpreendimentoSheet] Input:", input);
      try {
        // 1. Validate Empreendimento and check if sheet exists
        await connectToDatabase();
        const empreendimento = await Empreendimento.findById(input.empreendimentoId);
        if (!empreendimento) {
            console.error(`[tRPC sheets.createEmpreendimentoSheet] Empreendimento não encontrado: ${input.empreendimentoId}`);
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado' });
        }
        if (empreendimento.sheetId) {
             console.warn(`[tRPC sheets.createEmpreendimentoSheet] Empreendimento ${input.empreendimentoId} já possui planilha: ${empreendimento.sheetId}`);
             // Consider returning existing sheet info instead of error?
             // For now, throwing error to match previous logic.
             throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empreendimento já possui uma planilha associada.' });
        }
         // Ensure the name passed matches the one in the DB for consistency? Or use input name? Using input name.
         console.log(`[tRPC sheets.createEmpreendimentoSheet] Chamando lib createEmpreendimentoSheet para: ${empreendimento.name}`);
         // 2. Call the library function to create the sheet
         const result = await createEmpreendimentoSheet(input.empreendimentoId, empreendimento.name);
        console.log("[tRPC sheets.createEmpreendimentoSheet] Resultado da lib:", result);

        if (!result.success || !result.spreadsheetId) {
           console.error(`[tRPC sheets.createEmpreendimentoSheet] Erro na lib createEmpreendimentoSheet: ${result.error}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Falha ao criar planilha no Google Sheets',
          });
        }

        // 3. Update the Empreendimento document with the new sheet ID
         console.log(`[tRPC sheets.createEmpreendimentoSheet] Atualizando empreendimento ${input.empreendimentoId} com sheetId ${result.spreadsheetId}...`);
        await Empreendimento.findByIdAndUpdate(input.empreendimentoId, { sheetId: result.spreadsheetId });
         console.log("[tRPC sheets.createEmpreendimentoSheet] Empreendimento atualizado no DB.");

        return {
          success: true,
          sheetId: result.spreadsheetId,
          url: result.url, // Include the URL if returned by the lib function
          message: 'Planilha criada e associada ao empreendimento com sucesso.',
        };
      } catch (error) {
        console.error('[tRPC sheets.createEmpreendimentoSheet] Erro:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno ao criar planilha',
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }),
});

export type SheetsRouter = typeof sheetsRouter;