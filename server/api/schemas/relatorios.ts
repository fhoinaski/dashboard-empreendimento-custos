// server/api/schemas/relatorios.ts
import { z } from 'zod';
import mongoose from 'mongoose';
import { despesaCategorySchema } from './despesas'; // Reutilizar schema

// Schema de Filtro Comum para Relatórios
export const relatorioFilterSchema = z.object({
  startDate: z.string().datetime({ message: "Data inicial inválida (ISO 8601)" }),
  endDate: z.string().datetime({ message: "Data final inválida (ISO 8601)" }),
  empreendimentoId: z.string().refine((val) => val === 'todos' || mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
});
export type RelatorioFilterInput = z.infer<typeof relatorioFilterSchema>;

// --- Schemas de Output para Procedimentos ---

// KPIs (Key Performance Indicators)
export const kpiSchema = z.object({
    totalDespesas: z.number().default(0),
    mediaMensal: z.number().default(0),
    mesPico: z.object({ nome: z.string(), valor: z.number() }).nullable().default(null),
    categoriaPico: z.object({ nome: z.string(), valor: z.number() }).nullable().default(null),
    crescimentoUltimoMes: z.number().nullable().default(null), // Percentual vs mês anterior
    tendenciaGeral: z.enum(['aumento', 'estavel', 'queda']).default('estavel'), // Baseado nos últimos 3 meses
});
export type KpiOutput = z.infer<typeof kpiSchema>;

// Orçamento (Simulado/Exemplo)
export const orcamentoSchema = z.object({
    total: z.number().optional().default(0), // Orçamento total definido (ex: 150000)
    // utilizado e restante são calculados no frontend/hook combinando com KPIs
});
export type OrcamentoOutput = z.infer<typeof orcamentoSchema>;

// Tendências (Calculado no Backend)
export const tendenciasSchema = z.object({
    mediaTrimestral: z.number().default(0),
    previsaoProximoMes: z.number().default(0),
    percentualCrescimento: z.number().default(0), // Crescimento último vs penúltimo
    tendencia: z.enum(['aumento', 'estavel', 'queda']).default('estavel'), // Tendência 3 meses
});
export type TendenciasOutput = z.infer<typeof tendenciasSchema>;

// Despesas por Categoria
export const despesasPorCategoriaSchema = z.object({
    categorias: z.record(z.string(), z.number()).default({}), // { "Material": 1200, ... }
    maiorCategoria: z.object({ nome: z.string(), valor: z.number() }).nullable().default(null),
});
export type DespesasPorCategoriaOutput = z.infer<typeof despesasPorCategoriaSchema>;

// Despesas por Mês
export const despesasPorMesSchema = z.object({
    periodos: z.array(z.object({ nome: z.string(), valor: z.number() })).default([]), // [{ nome: "Jan/24", valor: 1000 }, ...]
    maiorPeriodo: z.object({ nome: z.string(), valor: z.number() }).nullable().default(null),
});
export type DespesasPorMesOutput = z.infer<typeof despesasPorMesSchema>;

// Comparativo Período
export const comparativoPeriodoSchema = z.object({
    periodos: z.array(z.object({
        nome: z.string(),
        atual: z.number().nullable(),
        anterior: z.number().nullable(),
    })).default([]),
    variacaoTotalPercentual: z.number().nullable().default(null),
});
export type ComparativoPeriodoOutput = z.infer<typeof comparativoPeriodoSchema>;

// Schema para Exportação (Input)
export const exportOptionsSchema = z.object({
    titulo: z.string().optional(),
    incluirGraficos: z.boolean().optional().default(false),
    // Incluir filtros usados na geração
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    empreendimentoId: z.string().optional(),
});

export const exportarRelatorioSchema = z.object({
    tipo: z.enum(['excel', 'pdf']),
    filtros: relatorioFilterSchema, // Passa os filtros usados
    opcoes: exportOptionsSchema.optional(),
});
export type ExportarRelatorioInput = z.infer<typeof exportarRelatorioSchema>;

// Schema para Exportação (Output)
export const exportarRelatorioResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    downloadUrl: z.string().url().optional(),
});
export type ExportarRelatorioResponse = z.infer<typeof exportarRelatorioResponseSchema>;