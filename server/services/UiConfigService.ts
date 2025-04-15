// ============================================================
// NOVO ARQUIVO: server/services/UiConfigService.ts
// ============================================================
import mongoose, { Types } from 'mongoose';
import { TRPCError } from '@trpc/server';
import { DynamicUIConfig, DynamicUIConfigDocument, DynamicUIConfigField } from '@/lib/db/models'; // Import model and interfaces
import connectToDatabase from '@/lib/db/mongodb';

// Type for the data input of upsertConfig (subset of DynamicUIConfigDocument fields)
type UpsertConfigInput = {
    labels?: Map<string, string> | Record<string, string>; // Allow Map or plain object
    fields?: DynamicUIConfigField[];
};

// Interface para a resposta lean de findByTenantAndModule
// Inclui os campos que queremos retornar, tipados corretamente
interface LeanDynamicUIConfig {
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    module: string;
    labels: Map<string, string>;
    fields: DynamicUIConfigField[];
    createdAt: Date;
    updatedAt: Date;
}


export class UiConfigService {

    /**
     * Finds UI configuration for a specific tenant and module.
     * @param tenantId - The ID of the tenant.
     * @param module - The name of the module (e.g., 'despesas').
     * @returns The configuration document (lean) or null if not found.
     */
    async findByTenantAndModule(
        tenantId: string | Types.ObjectId,
        module: string
    ): Promise<LeanDynamicUIConfig | null> {
        console.log(`[UiConfigService.findByTenantAndModule] Buscando config para Tenant: ${tenantId}, Módulo: ${module}`);
        if (!mongoose.isValidObjectId(tenantId)) {
            console.error(`[UiConfigService.findByTenantAndModule] ID de Tenant inválido: ${tenantId}`);
            // Lançar erro ou retornar null? Retornar null pode ser mais seguro para a API.
            return null;
            // throw new TRPCError({ code: 'BAD_REQUEST', message: 'ID de Tenant inválido.' });
        }
        const tenantObjectId = new Types.ObjectId(tenantId);

        try {
            await connectToDatabase();
            const config = await DynamicUIConfig.findOne({ tenantId: tenantObjectId, module })
                .select('-__v') // Exclui o campo __v
                .lean<LeanDynamicUIConfig | null>(); // Usa a interface Lean

            if (config) {
                console.log(`[UiConfigService.findByTenantAndModule] Configuração encontrada.`);
            } else {
                console.log(`[UiConfigService.findByTenantAndModule] Nenhuma configuração encontrada.`);
            }
            return config; // Retorna o objeto lean ou null

        } catch (error: any) {
            console.error(`[UiConfigService.findByTenantAndModule] Erro ao buscar configuração:`, error);
            // Não lançar TRPCError aqui, deixar o Controller/Router tratar
            throw new Error(`Erro ao buscar configuração de UI: ${error.message}`);
        }
    }

    /**
     * Creates or updates the UI configuration for a specific tenant and module.
     * @param tenantId - The ID of the tenant.
     * @param module - The name of the module.
     * @param data - The configuration data to upsert (labels and/or fields).
     * @returns The created or updated configuration document (lean).
     */
    async upsertConfig(
        tenantId: string | Types.ObjectId,
        module: string,
        data: UpsertConfigInput
    ): Promise<LeanDynamicUIConfig> {
        console.log(`[UiConfigService.upsertConfig] Upserting config para Tenant: ${tenantId}, Módulo: ${module}`);
        if (!mongoose.isValidObjectId(tenantId)) {
            console.error(`[UiConfigService.upsertConfig] ID de Tenant inválido: ${tenantId}`);
            throw new Error('ID de Tenant inválido.'); // Lança erro direto no service
        }
         if (!module || typeof module !== 'string' || module.trim() === '') {
             console.error(`[UiConfigService.upsertConfig] Nome do módulo inválido: ${module}`);
             throw new Error('Nome do módulo inválido.');
         }

        const tenantObjectId = new Types.ObjectId(tenantId);

        const updatePayload: { $set: Partial<DynamicUIConfigDocument>, $setOnInsert?: any } = {
            $set: { updatedAt: new Date() }, // Sempre atualiza updatedAt
            $setOnInsert: { createdAt: new Date(), tenantId: tenantObjectId, module } // Define na inserção
        };

        // Adiciona labels ao $set se fornecido
        if (data.labels !== undefined) {
            // Converte Record para Map se necessário
            updatePayload.$set.labels = data.labels instanceof Map
                ? data.labels
                : new Map(Object.entries(data.labels || {}));
        }

        // Adiciona fields ao $set se fornecido
        if (data.fields !== undefined) {
             // Validação básica dos fields (pode ser mais robusta)
             if (!Array.isArray(data.fields) || !data.fields.every(f => f.fieldName && f.label)) {
                 throw new Error('Estrutura inválida para o campo "fields".');
             }
             updatePayload.$set.fields = data.fields;
        }

        // Garante que pelo menos um campo (além de updatedAt) está sendo atualizado ou inserido
        if (Object.keys(updatePayload.$set).length <= 1 && !updatePayload.$setOnInsert) {
             console.warn("[UiConfigService.upsertConfig] Nenhuma alteração fornecida para atualização.");
             // Talvez retornar a config existente ou lançar erro? Por ora, lança erro.
             throw new Error("Nenhum dado válido fornecido para atualização.");
        }

        try {
            await connectToDatabase();
            const updatedConfig = await DynamicUIConfig.findOneAndUpdate(
                { tenantId: tenantObjectId, module }, // Filtro para encontrar o documento
                updatePayload,
                {
                    new: true, // Retorna o documento modificado
                    upsert: true, // Cria se não existir
                    runValidators: true, // Roda validadores do Mongoose
                    setDefaultsOnInsert: true, // Aplica defaults na inserção
                }
            ).select('-__v').lean<LeanDynamicUIConfig | null>(); // Usa lean e a interface Lean

            if (!updatedConfig) {
                console.error(`[UiConfigService.upsertConfig] Falha ao criar/atualizar configuração.`);
                throw new Error('Falha ao salvar configuração de UI.');
            }

            console.log(`[UiConfigService.upsertConfig] Configuração salva com sucesso. ID: ${updatedConfig._id}`);
            return updatedConfig; // Retorna o objeto lean

        } catch (error: any) {
            console.error(`[UiConfigService.upsertConfig] Erro ao salvar configuração:`, error);
             if (error instanceof mongoose.Error.ValidationError) {
                 // Extrai mensagens de erro de validação
                 const validationErrors = Object.values(error.errors).map(err => err.message).join(', ');
                 throw new Error(`Erro de validação: ${validationErrors}`);
             }
            throw new Error(`Erro ao salvar configuração de UI: ${error.message}`);
        }
    }

    // TODO: Adicionar getDefaultConfig se necessário.
    // Exemplo:
    // getDefaultConfig(module: string): Partial<DynamicUIConfigDocument> {
    //    if (module === 'despesas') {
    //       return {
    //          labels: new Map([['description', 'Descrição Padrão'], ['dueDate', 'Vencimento Padrão']]),
    //          fields: [
    //             { fieldName: 'description', label: 'Descrição Padrão', required: true, visible: true },
    //             // ... outros campos padrão
    //          ]
    //       }
    //    }
    //    return { labels: new Map(), fields: [] };
    // }
}
// ============================================================
// FIM DO ARQUIVO: server/services/UiConfigService.ts
// ============================================================