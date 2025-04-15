// ============================================================
// ARQUIVO CORRIGIDO: server/controllers/UiConfigController.ts
// (Correção na conversão de config.labels em updateConfig e getConfig)
// ============================================================
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { UiConfigService } from '../services/UiConfigService';
import {
    getUiConfigInputSchema,
    updateUiConfigInputSchema,
    dynamicUIConfigResponseSchema,
} from '../api/schemas/uiConfig';
import type { DynamicUIConfigResponse, DynamicUIConfigFieldInput } from '../api/schemas/uiConfig';
import type { Context } from '../api/context';
import mongoose, { Types } from 'mongoose';

// Interface interna para os dados de resposta antes da validação Zod
interface UiConfigData {
    _id: string;
    tenantId: string;
    module: string;
    labels: Record<string, string>; // Espera Record diretamente de lean()
    fields: DynamicUIConfigFieldInput[];
    createdAt: string;
    updatedAt: string;
}

// Interface para a resposta lean (o que esperamos do Mongoose .lean())
interface LeanDynamicUIConfig {
    _id: Types.ObjectId;
    tenantId: Types.ObjectId;
    module: string;
    labels?: Record<string, string>; // .lean() deve retornar Record ou undefined/null
    fields?: DynamicUIConfigFieldInput[]; // .lean() retorna array de objetos
    createdAt: Date;
    updatedAt: Date;
}


export class UiConfigController {
    private uiConfigService: UiConfigService;

    constructor() {
        this.uiConfigService = new UiConfigService();
    }

    /**
     * Busca a configuração de UI para um módulo específico do tenant atual.
     */
    async getConfig(
        input: z.infer<typeof getUiConfigInputSchema>,
        ctx: Context
    ): Promise<z.infer<typeof dynamicUIConfigResponseSchema> | null> {
        console.log(`[UiConfigController.getConfig] Buscando config para Tenant: ${ctx.tenantId}, Módulo: ${input.module}`);
        if (!ctx.tenantId) {
             throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tenant não identificado na sessão.' });
        }

        try {
            // O service retorna LeanDynamicUIConfig | null
            const config = await this.uiConfigService.findByTenantAndModule(ctx.tenantId, input.module);

            if (!config) {
                console.log(`[UiConfigController.getConfig] Configuração não encontrada para Tenant ${ctx.tenantId}, Módulo ${input.module}. Retornando null.`);
                return null;
            }

            // *** CORREÇÃO AQUI (getConfig) ***
            // Usa diretamente o objeto retornado por .lean(), com fallback para {}
            const labelsObject = config.labels || {};
            // -----------------------

             // Prepara o objeto para validação Zod
             const dataToValidate: UiConfigData = {
                _id: config._id.toString(),
                tenantId: config.tenantId.toString(),
                module: config.module,
                labels: labelsObject, // Usa o objeto diretamente
                fields: (config.fields || []).map(f => ({
                    fieldName: f.fieldName,
                    label: f.label,
                    required: f.required,
                    visible: f.visible,
                    order: f.order
                })),
                createdAt: config.createdAt.toISOString(),
                updatedAt: config.updatedAt.toISOString(),
            };

            console.log("[UiConfigController.getConfig] Configuração encontrada, validando e retornando.");
            return dynamicUIConfigResponseSchema.parse(dataToValidate);

        } catch (error: any) {
            console.error(`[UiConfigController.getConfig] Erro ao buscar configuração:`, error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Erro ao buscar configuração de UI: ${error.message}`,
                cause: error,
            });
        }
    }

    /**
     * Cria ou atualiza a configuração de UI para um módulo específico do tenant atual.
     */
    async updateConfig(
        input: z.infer<typeof updateUiConfigInputSchema>,
        ctx: Context
    ): Promise<z.infer<typeof dynamicUIConfigResponseSchema>> {
        console.log(`[UiConfigController.updateConfig] Atualizando config para Tenant: ${ctx.tenantId}, Módulo: ${input.module}`);
         if (!ctx.tenantId) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tenant não identificado na sessão.' });
        }

        try {
             const { module, data } = input;

             // Converte input.data.labels (Record) para Map ANTES de passar para o service
             const dataForService = {
                ...data,
                labels: data.labels ? new Map(Object.entries(data.labels)) : undefined,
            };

            // O Service faz o upsert e retorna o documento Mongoose (não lean) ou o lean
            // Vamos assumir que o service retorna o objeto lean diretamente após a operação
            const updatedConfig = await this.uiConfigService.upsertConfig(
                ctx.tenantId,
                module,
                dataForService // Passa os dados (com Map para labels, se o service espera)
            );

            // *** CORREÇÃO AQUI (updateConfig) ***
            // Usa diretamente o objeto retornado por .lean() do service, com fallback para {}
            // Assume que `updatedConfig.labels` já é um Record<string, string> por causa do .lean() no service
            const labelsObject = updatedConfig.labels || {};
            // -----------------------

              // Prepara o objeto para validação Zod
             const dataToValidate: UiConfigData = {
                 _id: updatedConfig._id.toString(),
                 tenantId: updatedConfig.tenantId.toString(),
                 module: updatedConfig.module,
                 labels: labelsObject, // Usa o objeto retornado por lean()
                 fields: (updatedConfig.fields || []).map(f => ({
                     fieldName: f.fieldName,
                     label: f.label,
                     required: f.required,
                     visible: f.visible,
                     order: f.order
                 })),
                 createdAt: updatedConfig.createdAt.toISOString(),
                 updatedAt: updatedConfig.updatedAt.toISOString(),
             };

            console.log(`[UiConfigController.updateConfig] Configuração salva com sucesso. ID: ${updatedConfig._id}`);
            return dynamicUIConfigResponseSchema.parse(dataToValidate);

        } catch (error: any) {
            console.error(`[UiConfigController.updateConfig] Erro ao salvar configuração:`, error);
             const errorCode = error.message?.includes('valid') ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR';
            // Relança o erro como TRPCError para o cliente tRPC
            throw new TRPCError({
                code: errorCode,
                message: `Erro ao salvar configuração de UI: ${error.message}`,
                cause: error,
            });
        }
    }
}
// ============================================================
// FIM DO ARQUIVO CORRIGIDO
// ============================================================