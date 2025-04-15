// ============================================================
// NOVO ARQUIVO: server/api/routers/uiConfig.router.ts
// ============================================================
import { router, protectedProcedure, tenantProcedure, tenantAdminProcedure } from '../trpc'; // Importa procedimentos com controle de acesso
import { z } from 'zod';
import { UiConfigController } from '../../controllers/UiConfigController'; // Importa o Controller
import {
    getUiConfigInputSchema,
    updateUiConfigInputSchema,
    dynamicUIConfigResponseSchema, // Schema para validar a resposta
} from '../schemas/uiConfig'; // Importa os Schemas Zod de Input/Output
import type { Context } from '../context'; // Importa o tipo Context

// Instancia o Controller
const uiConfigController = new UiConfigController();

export const uiConfigRouter = router({

    /**
     * Procedure para buscar a configuração de UI de um módulo para o tenant atual.
     * Acessível por qualquer usuário logado pertencente a um tenant.
     * Retorna a configuração encontrada ou null se não houver customização.
     */
    getUiConfig: tenantProcedure // Requer usuário logado e com tenantId válido
        .input(getUiConfigInputSchema) // Valida que 'module' é uma string não vazia
        // Define o output como o schema de resposta OU null
        .output(dynamicUIConfigResponseSchema.nullable())
        .query(async ({ input, ctx }: { input: z.infer<typeof getUiConfigInputSchema>, ctx: Context }) => {
            console.log(`[tRPC uiConfig.getUiConfig] Chamando controller para Tenant: ${ctx.tenantId}, Módulo: ${input.module}`);
            // Chama o método do controller, passando input e contexto
            // O controller retorna a configuração validada ou null
            return uiConfigController.getConfig(input, ctx);
        }),

    /**
     * Procedure para criar ou atualizar a configuração de UI de um módulo para o tenant atual.
     * Acessível apenas por administradores do tenant.
     * Retorna a configuração atualizada.
     */
    updateUiConfig: tenantAdminProcedure // Requer usuário logado, com tenantId válido e role 'admin'
        .input(updateUiConfigInputSchema) // Valida 'module' e 'data' (labels e fields)
        .output(dynamicUIConfigResponseSchema) // Retorna a configuração atualizada e validada
        .mutation(async ({ input, ctx }: { input: z.infer<typeof updateUiConfigInputSchema>, ctx: Context }) => {
             console.log(`[tRPC uiConfig.updateUiConfig] Chamando controller para Tenant: ${ctx.tenantId}, Módulo: ${input.module}`);
            // Chama o método do controller, passando input e contexto
            // O controller faz o upsert e retorna a configuração validada
            return uiConfigController.updateConfig(input, ctx);
        }),

});

// Exporta o tipo do router para uso no cliente tRPC
export type UiConfigRouter = typeof uiConfigRouter;
// ============================================================
// FIM DO ARQUIVO: server/api/routers/uiConfig.router.ts
// ============================================================