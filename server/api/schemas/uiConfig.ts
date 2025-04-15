// ============================================================
// NOVO ARQUIVO: server/api/schemas/uiConfig.ts
// ============================================================
import { z } from 'zod';

// Schema para o subdocumento 'field'
export const dynamicUIConfigFieldSchema = z.object({
    fieldName: z.string().trim().min(1, "Nome do campo é obrigatório"),
    label: z.string().trim().min(1, "Label do campo é obrigatório"),
    required: z.boolean(),
    visible: z.boolean(),
    order: z.number().int().optional(),
});
export type DynamicUIConfigFieldInput = z.infer<typeof dynamicUIConfigFieldSchema>;

// --- Schemas de Input ---

// Schema para buscar configuração
export const getUiConfigInputSchema = z.object({
  module: z.string().trim().min(1, "Nome do módulo é obrigatório"),
});
export type GetUiConfigInput = z.infer<typeof getUiConfigInputSchema>;

// Schema para atualizar configuração
// Permite atualizar labels ou fields, ou ambos.
export const updateUiConfigDataSchema = z.object({
    // Labels: um objeto onde as chaves são os labels originais e os valores são os customizados
    labels: z.record(z.string(), z.string()) // Ex: { "Descrição": "Detalhes", "Data Venc.": "Prazo Final" }
        .optional()
        .refine(val => !val || Object.values(val).every(v => typeof v === 'string'), {
            message: "Todos os labels customizados devem ser strings."
        }),
    // Fields: um array com a configuração de cada campo
    fields: z.array(dynamicUIConfigFieldSchema)
        .optional()
        // Validação adicional: garante que fieldName seja único dentro do array
        .refine(fields => !fields || new Set(fields.map(f => f.fieldName)).size === fields.length, {
            message: "Nomes de campo (fieldName) devem ser únicos dentro do módulo.",
            // path: ["fields"], // Pode associar o erro ao array todo
        }),
});

export const updateUiConfigInputSchema = z.object({
  module: z.string().trim().min(1, "Nome do módulo é obrigatório"),
  data: updateUiConfigDataSchema, // Aninha os dados de configuração
});
export type UpdateUiConfigInput = z.infer<typeof updateUiConfigInputSchema>;


// --- Schemas de Output ---

// Schema para a resposta da configuração de UI (usado por get e update)
// É similar ao updateUiConfigDataSchema, mas garante que os campos não sejam opcionais na resposta,
// e usa Record para labels para compatibilidade JSON/tRPC.
export const dynamicUIConfigResponseSchema = z.object({
    _id: z.string(), // ObjectId convertido para string
    tenantId: z.string(), // ObjectId convertido para string
    module: z.string(),
    labels: z.record(z.string(), z.string()).default({}), // Objeto { original: custom }
    fields: z.array(dynamicUIConfigFieldSchema).default([]), // Array de configurações de campo
    createdAt: z.string().datetime(), // ISO String
    updatedAt: z.string().datetime(), // ISO String
});
export type DynamicUIConfigResponse = z.infer<typeof dynamicUIConfigResponseSchema>;

// ============================================================
// FIM DO ARQUIVO: server/api/schemas/uiConfig.ts
// ============================================================