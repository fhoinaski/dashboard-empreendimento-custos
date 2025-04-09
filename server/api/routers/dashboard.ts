// server/api/routers/dashboard.ts
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    dashboardFilterSchema,
    dashboardStatsSchema,
    expenseChartDataSchema,
    revenueChartDataSchema
} from '../schemas/dashboard'; // Importar schemas
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Despesa, DespesaDocument } from '@/lib/db/models';
import mongoose, { PipelineStage, FilterQuery, Types } from 'mongoose';
import { startOfDay, endOfDay, subDays, differenceInDays, addDays, parseISO, isValid } from 'date-fns';

// --- Helper Functions (Keep as is) ---
function calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return current > 0 ? Infinity : null; // Represent infinite increase or null if current is also 0 or less
    const change = ((current - previous) / previous) * 100;
    // Handle Infinity result specifically if needed, otherwise return NaN/null for invalid inputs
    if (!isFinite(change)) return current > previous ? Infinity : (current < previous ? -Infinity : 0);
    return isNaN(change) ? null : change;
}
const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
    if (!dateInput) return undefined; try { let date; if (typeof dateInput === 'string') date = parseISO(dateInput); else if (dateInput instanceof Date) date = dateInput; else return undefined; return isValid(date) ? date : undefined; } catch (e) { console.warn("safeParseDate error:", e); return undefined; }
};
// --- End Helpers ---

// Output type matching the zod schema
type DashboardStatsOutput = z.infer<typeof dashboardStatsSchema>;
type ExpenseChartDataOutput = z.infer<typeof expenseChartDataSchema>;
type RevenueChartDataOutput = z.infer<typeof revenueChartDataSchema>;


/**
 * Roteador para dashboard
 */
export const dashboardRouter = router({
    getStats: adminProcedure
        .input(dashboardFilterSchema.optional())
        .output(dashboardStatsSchema)
        .query(async ({ input }): Promise<DashboardStatsOutput> => {
            try {
                await connectToDatabase();
                console.log("[tRPC dashboard.getStats] Input recebido:", input);

                // 1. Define Períodos
                const endDate = input?.endDate ? endOfDay(safeParseDate(input.endDate)!) : endOfDay(new Date());
                const startDate = input?.startDate ? startOfDay(safeParseDate(input.startDate)!) : startOfDay(subDays(endDate, 29));
                const empreendimentoIdParam = input?.empreendimentoId;

                if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
                     throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período inválido.' });
                }
                console.log(`[tRPC dashboard.getStats] Período Atual: ${startDate.toISOString()} a ${endDate.toISOString()}`);

                const daysInPeriod = differenceInDays(endDate, startDate) + 1;
                const prevEndDate = endOfDay(subDays(startDate, 1));
                const prevStartDate = startOfDay(subDays(prevEndDate, daysInPeriod - 1));
                console.log(`[tRPC dashboard.getStats] Período Anterior: ${prevStartDate.toISOString()} a ${prevEndDate.toISOString()}`);


                // 2. Filtro Base por Empreendimento
                const baseEmpFilter: FilterQuery<DespesaDocument> = {};
                if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
                    baseEmpFilter.empreendimento = new mongoose.Types.ObjectId(empreendimentoIdParam);
                    console.log(`[tRPC dashboard.getStats] Filtrando pelo empreendimento: ${empreendimentoIdParam}`);
                } else if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
                    console.warn(`[tRPC dashboard.getStats] ID de empreendimento inválido: ${empreendimentoIdParam}. Ignorando filtro.`);
                }

                // --- 3. Agregação Principal (Período ATUAL) ---
                // Filtro principal: Despesas INCORRIDAS (date) no período
                const currentMatchFilter: FilterQuery<DespesaDocument> = {
                    date: { $gte: startDate, $lte: endDate }, // Baseado na DATA DA DESPESA
                    ...baseEmpFilter
                };
                console.log("[tRPC dashboard.getStats] Filtro Agregação Atual:", JSON.stringify(currentMatchFilter));

                const currentPeriodPipeline: PipelineStage[] = [
                    { $match: currentMatchFilter },
                    {
                        $group: {
                            _id: null,
                            // Total Geral (Incorrido no período, independente de status)
                            totalAllValue: { $sum: '$value' },
                            totalAllCount: { $sum: 1 },
                            // Aprovadas (Incorridas no período)
                            totalApprovedValue: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Aprovado'] }, '$value', 0] } },
                            totalApprovedCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Aprovado'] }, 1, 0] } },
                            // A Vencer (Aprovadas, Incorridas no período, VENCENDO no período)
                            dueValue: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] }] }, '$value', 0] } },
                            dueCount: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] }] }, 1, 0] } },
                            // Pagas (Aprovadas, Incorridas no período, PAGAS/VENCENDO no período) - Considera pagas mesmo se dueDate for antes
                             paidValue: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate',endDate] }] }, '$value', 0 ] } }, // Refinado: pagas que venceram no periodo
                             paidCount: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate',endDate] }] }, 1, 0 ] } }, // Refinado: pagas que venceram no periodo
                            // Aguardando Aprovação (Incorridas no período)
                            pendingApprovalValue: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, '$value', 0] } },
                            pendingApprovalCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, 1, 0] } }
                        }
                    }
                ];
                const currentStatsResult = await Despesa.aggregate(currentPeriodPipeline);
                const currentData = currentStatsResult[0] || {
                    totalAllValue: 0, totalAllCount: 0, totalApprovedValue: 0, totalApprovedCount: 0,
                    dueValue: 0, dueCount: 0, paidValue: 0, paidCount: 0, pendingApprovalValue: 0, pendingApprovalCount: 0
                };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Atual:", JSON.stringify(currentData));

                // --- 4. Agregação Período ANTERIOR (Comparação) ---
                 // Filtro: Despesas APROVADAS INCORRIDAS (date) no período ANTERIOR
                 const previousMatchFilter: FilterQuery<DespesaDocument> = {
                     approvalStatus: 'Aprovado', // Apenas aprovadas
                     date: { $gte: prevStartDate, $lte: prevEndDate }, // Baseado na DATA DA DESPESA
                     ...baseEmpFilter
                 };
                console.log("[tRPC dashboard.getStats] Filtro Agregação Anterior:", JSON.stringify(previousMatchFilter));

                const previousPeriodPipeline: PipelineStage[] = [
                    { $match: previousMatchFilter },
                    {
                        $group: {
                            _id: null,
                            totalApprovedValue: { $sum: '$value' }, // Total Aprovado Incorrido no período anterior
                             // Opcional: Calcular Due/Paid do período anterior se necessário para comparação específica
                             dueValue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', prevStartDate] }, { $lte: ['$dueDate', prevEndDate] }] }, '$value', 0] } },
                             paidValue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', prevStartDate] }, { $lte: ['$dueDate', prevEndDate] }] }, '$value', 0] } },
                             totalAllValue: { $sum: '$value' }, // Total Aprovado Incorrido no período anterior
                        }
                    }
                ];
                const previousStatsResult = await Despesa.aggregate(previousPeriodPipeline);
                const previousData = previousStatsResult[0] || { totalApprovedValue: 0, dueValue: 0, paidValue: 0, totalAllValue: 0 };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Anterior:", JSON.stringify(previousData));

                // --- 5. Cálculo Comparação ---
                const comparisonData = {
                    totalApprovedChange: calculatePercentageChange(currentData.totalApprovedValue, previousData.totalApprovedValue),
                    dueChange: calculatePercentageChange(currentData.dueValue, previousData.dueValue), // Compara due/paid por vencimento
                    paidChange: calculatePercentageChange(currentData.paidValue, previousData.paidValue),
                };
                console.log("[tRPC dashboard.getStats] Dados Comparação:", comparisonData);

                // --- 6. Cálculo Despesas Próximas (A VENCER) ---
                const todayStart = startOfDay(new Date());
                const upcomingEndDate = endOfDay(addDays(todayStart, 7));
                const upcomingMatchFilter: FilterQuery<DespesaDocument> = {
                    approvalStatus: 'Aprovado', // Apenas Aprovadas
                    status: 'A vencer',
                    dueDate: { $gte: todayStart, $lte: upcomingEndDate },
                    ...baseEmpFilter
                };
                console.log("[tRPC dashboard.getStats] Filtro Próximas Despesas:", JSON.stringify(upcomingMatchFilter));
                const upcomingStatsPipeline: PipelineStage[] = [ { $match: upcomingMatchFilter }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value'} }} ];
                const upcomingStats = await Despesa.aggregate(upcomingStatsPipeline);
                const upcomingExpensesData = upcomingStats[0] || { count: 0, value: 0 };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Próximas:", JSON.stringify(upcomingExpensesData));

                // --- 7. Contagem Total de Empreendimentos ---
                const empreendimentosCount = await Empreendimento.countDocuments( baseEmpFilter.empreendimento ? { _id: baseEmpFilter.empreendimento } : {} );
                console.log(`[tRPC dashboard.getStats] Total Empreendimentos: ${empreendimentosCount}`);

                // --- 8. Montagem da Resposta Final ---
                const finalData: DashboardStatsOutput = {
                    totalEmpreendimentos: empreendimentosCount,
                    currentPeriod: {
                        totalApprovedValue: currentData.totalApprovedValue, // Aprovadas na data
                        totalApprovedCount: currentData.totalApprovedCount,
                        dueValue: currentData.dueValue,     // A vencer na due date
                        dueCount: currentData.dueCount,
                        paidValue: currentData.paidValue,   // Pagas na due date
                        paidCount: currentData.paidCount,
                        totalAllValue: currentData.totalAllValue, // Todas na data
                        totalAllCount: currentData.totalAllCount,
                    },
                    previousPeriod: { // Baseado na data da despesa
                        totalApprovedValue: previousData.totalApprovedValue,
                        dueValue: previousData.dueValue, // Baseado na due date do período anterior
                        paidValue: previousData.paidValue, // Baseado na due date do período anterior
                        totalAllValue: previousData.totalAllValue, // Total aprovado na data do período anterior
                    },
                    comparison: { // Compara Total Aprovado (baseado na data)
                        totalApprovedChange: comparisonData.totalApprovedChange,
                        dueChange: comparisonData.dueChange,
                        paidChange: comparisonData.paidChange,
                    },
                    pendingApproval: { // Pendentes na data
                        value: currentData.pendingApprovalValue,
                        count: currentData.pendingApprovalCount
                    },
                    upcomingExpenses: { // Próximos 7 dias por due date
                        count: upcomingExpensesData.count,
                        value: upcomingExpensesData.value,
                    },
                };
                console.log("[tRPC dashboard.getStats] Dados Finais:", JSON.stringify(finalData));
                return dashboardStatsSchema.parse(finalData);

            } catch (error: unknown) {
                console.error("[tRPC dashboard.getStats] Erro Final:", error);
                const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar dados do dashboard';
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorMessage });
            }
        }),

    // --- getExpenseChartData (Remains based on 'date' and 'Aprovado') ---
    getExpenseChartData: adminProcedure
        .input(dashboardFilterSchema.optional())
        .output(expenseChartDataSchema)
        .query(async ({ input }): Promise<ExpenseChartDataOutput> => {
            try {
                await connectToDatabase();
                console.log("[tRPC dashboard.getExpenseChartData] Input:", input);
                const endDate = input?.endDate ? endOfDay(safeParseDate(input.endDate)!) : endOfDay(new Date());
                const defaultStartDate = startOfDay(subDays(endDate, 365));
                const startDate = input?.startDate ? startOfDay(safeParseDate(input.startDate)!) : defaultStartDate;
                const empreendimentoIdParam = input?.empreendimentoId;

                if (!isValid(startDate) || !isValid(endDate) || startDate > endDate) {
                     throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período inválido para gráfico.' });
                }
                 console.log(`[tRPC dashboard.getExpenseChartData] Período: ${startDate.toISOString()} a ${endDate.toISOString()}`);

                const matchFilter: FilterQuery<DespesaDocument> = {
                    approvalStatus: 'Aprovado', // Somente aprovadas
                    date: { $gte: startDate, $lte: endDate } // Baseado na DATA DA DESPESA
                };
                if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
                    matchFilter.empreendimento = new Types.ObjectId(empreendimentoIdParam);
                }
                 console.log("[tRPC dashboard.getExpenseChartData] Filtro:", JSON.stringify(matchFilter));

                const [byMonth, byCategory] = await Promise.all([
                    Despesa.aggregate([
                        { $match: matchFilter },
                        { $group: { _id: { month: { $month: "$date" }, year: { $year: "$date" } }, value: { $sum: "$value" } } },
                        { $sort: { "_id.year": 1, "_id.month": 1 } },
                        { $project: { _id: 0, month: { $arrayElemAt: [["Inv", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], "$_id.month"] }, value: 1 } }
                    ]),
                    Despesa.aggregate([
                        { $match: matchFilter },
                        { $group: { _id: "$category", value: { $sum: "$value" } } },
                        { $project: { _id: 0, category: "$_id", value: 1 } }
                    ])
                ]);
                 console.log("[tRPC dashboard.getExpenseChartData] Dados por Mês:", byMonth.length);
                 console.log("[tRPC dashboard.getExpenseChartData] Dados por Categoria:", byCategory.length);

                const categoryMap = byCategory.reduce((acc, item) => { if (item.category && typeof item.value === 'number') { acc[item.category] = item.value; } return acc; }, {} as Record<string, number>);
                const result = { byMonth: byMonth.map(m => ({ month: m.month, value: m.value ?? 0 })), byCategory: categoryMap };
                return expenseChartDataSchema.parse(result);
            } catch (error: unknown) { /* ... error handling ... */
                 console.error("[tRPC dashboard.getExpenseChartData] Erro:", error);
                 const errorMessage = error instanceof Error ? error.message : 'Erro gráfico despesas';
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorMessage });
            }
        }),

    // --- getRevenueChartData (Remains placeholder) ---
    getRevenueChartData: adminProcedure
        .input(dashboardFilterSchema.optional())
        .output(revenueChartDataSchema)
        .query(async ({ input }): Promise<RevenueChartDataOutput> => {
            /* ... placeholder logic ... */
            console.warn("[tRPC dashboard.getRevenueChartData] Rota de receita ainda é mock.");
            await new Promise(res => setTimeout(res, 100));
            const mockRevenue = [ { month: "Jan", value: 15000 }, { month: "Fev", value: 18000 }, { month: "Mar", value: 22000 }, { month: "Abr", value: 19500 }, { month: "Mai", value: 25000 }, { month: "Jun", value: 21000 }, ];
            return revenueChartDataSchema.parse({ byMonth: mockRevenue });
        }),
});

export type DashboardRouter = typeof dashboardRouter;