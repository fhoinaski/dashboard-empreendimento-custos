// ============================================================
// START OF REFACTORED FILE: server/api/routers/sheets.ts
// (Fixed: Replaced adminProcedure with tenantAdminProcedure and added tenant check)
// ============================================================
import { router, tenantAdminProcedure } from '../trpc'; // <-- CORRIGIDO: Usa tenantAdminProcedure
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createSheetSchema } from '../schemas/sheets'; // Import schema
import { createEmpreendimentoSheet } from '@/lib/google/sheets'; // Import da lib
import connectToDatabase from '@/lib/db/mongodb'; // Import DB connection
import { Empreendimento } from '@/lib/db/models'; // Import Empreendimento model
import mongoose, { Types } from 'mongoose'; // Import Types
import type { Context } from '../context'; // Import Context

export const sheetsRouter = router({
  // Criar planilha para empreendimento (Restrito a Tenant Admin)
  createEmpreendimentoSheet: tenantAdminProcedure // <-- CORRIGIDO: Usa tenantAdminProcedure
    .input(createSheetSchema)
    .mutation(async ({ input, ctx }) => { // ctx agora tem tenantId e user garantidos
      console.log(`[tRPC sheets.createEmpreendimentoSheet] Tenant: ${ctx.tenantId!}, Input:`, input);
      const tenantObjectId = new Types.ObjectId(ctx.tenantId!); // Garante ObjectId

      try {
        // 1. Valida Empreendimento DENTRO do tenant e verifica se já tem planilha
        await connectToDatabase();
        const empreendimento = await Empreendimento.findOne({
            _id: new Types.ObjectId(input.empreendimentoId),
            tenantId: tenantObjectId // <-- Garante que pertence ao tenant
        });

        if (!empreendimento) {
            console.error(`[tRPC sheets.createEmpreendimentoSheet] Empreendimento ${input.empreendimentoId} não encontrado no tenant ${ctx.tenantId!}`);
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Empreendimento não encontrado neste tenant' });
        }
        if (empreendimento.sheetId) {
             console.warn(`[tRPC sheets.createEmpreendimentoSheet] Empreendimento ${input.empreendimentoId} já possui planilha: ${empreendimento.sheetId}`);
             throw new TRPCError({ code: 'BAD_REQUEST', message: 'Empreendimento já possui uma planilha associada.' });
        }

         // Usa o nome do empreendimento do banco de dados para consistência
         const empreendimentoNameFromDB = empreendimento.name;
         console.log(`[tRPC sheets.createEmpreendimentoSheet] Chamando lib createEmpreendimentoSheet para: ${empreendimentoNameFromDB}`);

         // 2. Chama a função da biblioteca para criar a planilha (passa tenantId)
         const result = await createEmpreendimentoSheet(tenantObjectId, input.empreendimentoId, empreendimentoNameFromDB);
         console.log("[tRPC sheets.createEmpreendimentoSheet] Resultado da lib:", result);

        if (!result.success || !result.spreadsheetId) {
           console.error(`[tRPC sheets.createEmpreendimentoSheet] Erro na lib createEmpreendimentoSheet: ${result.error}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error || 'Falha ao criar planilha no Google Sheets',
          });
        }

        // 3. Atualiza o documento Empreendimento com o novo sheet ID
         console.log(`[tRPC sheets.createEmpreendimentoSheet] Atualizando empreendimento ${input.empreendimentoId} com sheetId ${result.spreadsheetId}...`);
         await Empreendimento.updateOne(
             { _id: empreendimento._id, tenantId: tenantObjectId }, // Confirma o filtro novamente
             { $set: { sheetId: result.spreadsheetId, updatedAt: new Date() } }
         );
         console.log("[tRPC sheets.createEmpreendimentoSheet] Empreendimento atualizado no DB.");

        // 4. Retorna sucesso
        return {
          success: true,
          sheetId: result.spreadsheetId,
          url: result.url,
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
// ============================================================
// END OF REFACTORED FILE: server/api/routers/sheets.ts
// ============================================================