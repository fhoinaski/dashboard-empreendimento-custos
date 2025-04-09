// server/api/schemas/dashboard.ts
import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados do dashboard (tRPC)
 */

// Schema para filtros do dashboard (usado por getStats, getExpenseChartData, getRevenueChartData)
export const dashboardFilterSchema = z.object({
  // Datas devem ser enviadas no formato ISO 8601 (string)
  startDate: z.string().datetime({ message: "Data inicial inválida (ISO 8601)" }).optional(),
  endDate: z.string().datetime({ message: "Data final inválida (ISO 8601)" }).optional(),
  // Permite 'todos' ou um ObjectId válido
  empreendimentoId: z.string().refine((val) => val === 'todos' || mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
});
export type DashboardFilterInput = z.infer<typeof dashboardFilterSchema>;

// Schema para o output de getStats (validando a estrutura retornada pelo router)
export const dashboardStatsSchema = z.object({
    totalEmpreendimentos: z.number().int().min(0),
    currentPeriod: z.object({
        totalApprovedValue: z.number(), // Aprovadas (Pago ou A Vencer) com VENCIMENTO no período
        totalApprovedCount: z.number().int().min(0),
        dueValue: z.number(), // A Vencer (Aprovadas) com VENCIMENTO no período
        dueCount: z.number().int().min(0),
        paidValue: z.number(), // Pagas (Aprovadas) com VENCIMENTO no período
        paidCount: z.number().int().min(0),
        totalAllValue: z.number(), // Total GERAL CRIADO no período
        totalAllCount: z.number().int().min(0),
    }),
    previousPeriod: z.object({
        totalApprovedValue: z.number(), // Total aprovado que VENCEU no período anterior
        dueValue: z.number(),
        paidValue: z.number(),
        totalAllValue: z.number(), // Total aprovado que VENCEU no período anterior
    }).optional(), // Pode não haver período anterior
    comparison: z.object({
        totalApprovedChange: z.number().nullable(), // Comparação de totalApprovedValue
        dueChange: z.number().nullable(),
        paidChange: z.number().nullable(),
    }).optional(), // Pode não haver comparação
    pendingApproval: z.object({ // Despesas criadas no período atual, ainda pendentes
        count: z.number().int().min(0),
        value: z.number(),
    }).optional(), // Pode não haver pendentes
    upcomingExpenses: z.object({ // Despesas 'A Vencer' (aprovadas) nos próximos 7 dias
        count: z.number().int().min(0),
        value: z.number(),
    }).optional(), // Pode não haver próximas
});
export type DashboardStatsOutput = z.infer<typeof dashboardStatsSchema>;

// Schema para os pontos de dados mensais nos gráficos
const chartMonthDataPointSchema = z.object({
    month: z.string(), // e.g., "Jan", "Fev"
    value: z.number(),
});

// Schema para os dados por categoria (Record<string, number>)
const chartCategoryDataSchema = z.record(z.string(), z.number()); // e.g., { "Material": 1200, "Serviço": 800 }

// Schema para o output de getExpenseChartData
export const expenseChartDataSchema = z.object({
    byMonth: z.array(chartMonthDataPointSchema), // Despesas APROVADAS por mês de CRIAÇÃO/DATA
    byCategory: chartCategoryDataSchema, // Despesas APROVADAS por categoria (no período selecionado)
});
export type ExpenseChartDataOutput = z.infer<typeof expenseChartDataSchema>;

// Schema para o output de getRevenueChartData (exemplo)
export const revenueChartDataSchema = z.object({
    byMonth: z.array(chartMonthDataPointSchema), // Receita por mês
});
export type RevenueChartDataOutput = z.infer<typeof revenueChartDataSchema>;