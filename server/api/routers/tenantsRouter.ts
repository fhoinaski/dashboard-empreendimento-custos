
import { router, superAdminProcedure } from '../trpc'; // Usa superAdminProcedure corretamente
import { z } from 'zod';
import { TenantController } from '../../controllers/TenantController'; // Importa o Controller (Verifique o caminho relativo)
import {
    listTenantsFilterSchema,
    updateTenantStatusInputSchema,
    createTenantWithAdminInputSchema,
    tenantListResponseSchema,
    simpleSuccessResponseSchema,
    createTenantResponseSchema
    // Os schemas individuais como tenantListItemSchema não são mais necessários aqui,
    // pois a validação do output é feita no controller ou pelo output() do procedure.
} from '../schemas/tenants'; // Caminho corrigido para /schemas/tenants
import type { Context } from '../context'; // Importa o tipo Context

// Instancia o Controller (pode ser feito fora se usar injeção de dependência em projetos maiores)
const tenantController = new TenantController();

export const tenantsRouter = router({
    // --- Listar Tenants (Super Admin) ---
    // O router valida o input e chama o controller. A lógica de busca e agregação está no controller.
    listTenants: superAdminProcedure
        .input(listTenantsFilterSchema) // Valida o input com Zod
        .output(tenantListResponseSchema) // Define/Valida o formato da resposta
        .query(async ({ input, ctx }) => { // Recebe input validado e contexto
            // Chama o método do controller, passando input e contexto
            // A validação do output é garantida pelo .output() acima e pela implementação do controller
            return tenantController.list(input, ctx);
        }),

    // --- Criar Tenant (Super Admin) ---
    // O router valida o input e chama o controller. A lógica de criação está no service chamado pelo controller.
    createTenant: superAdminProcedure
        .input(createTenantWithAdminInputSchema) // Valida o input
        .output(createTenantResponseSchema) // Define/Valida o formato da resposta
        .mutation(async ({ input, ctx }) => { // Recebe input validado e contexto
            // Chama o método do controller
            // A validação do output é garantida pelo .output() e pelo controller
            return tenantController.create(input, ctx);
        }),

    // --- Atualizar Status do Tenant (Super Admin) ---
    // O router valida o input e chama o controller. A lógica de atualização está no service chamado pelo controller.
    updateStatus: superAdminProcedure
        .input(updateTenantStatusInputSchema) // Valida o input
        .output(simpleSuccessResponseSchema) // Define/Valida o formato da resposta
        .mutation(async ({ input, ctx }) => { // Recebe input validado e contexto
            // Chama o método do controller
            // A validação do output é garantida pelo .output() e pelo controller
            return tenantController.updateStatus(input, ctx);
        }),

    // TODO: Adicionar procedures futuras aqui, sempre delegando ao controller
    // Exemplo:
    // getTenantDetails: superAdminProcedure
    //  .input(z.object({ tenantId: z.string().refine(...) }))
    //  .query(({ input, ctx }) => tenantController.getDetails(input, ctx)),
});

// Exporta o tipo do router para uso no cliente tRPC
export type TenantsRouter = typeof tenantsRouter;
