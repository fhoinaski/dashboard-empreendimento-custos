// ============================================================
// START OF REFACTORED FILE: server/api/routers/dashboard.ts
// (Fixed: Replaced adminProcedure with tenantAdminProcedure and added tenant filtering)
// ============================================================
import { router, tenantAdminProcedure } from '../trpc'; // <-- CORRIGIDO: Usa tenantAdminProcedure
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    dashboardFilterSchema,
    dashboardStatsSchema,
    expenseChartDataSchema,
    revenueChartDataSchema
} from '../schemas/dashboard';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Despesa, DespesaDocument } from '@/lib/db/models';
import mongoose, { PipelineStage, FilterQuery, Types } from 'mongoose';
import { startOfDay, endOfDay, subDays, differenceInDays, addDays, parseISO, isValid as isDateValid } from 'date-fns';
import type { Context } from '../context'; // Import Context

// --- Helper Functions ---
function calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return current > 0 ? Infinity : null;
    const change = ((current - previous) / previous) * 100;
    if (!isFinite(change)) return change > 0 ? Infinity : (change < 0 ? -Infinity : 0);
    return isNaN(change) ? null : change;
}
const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
    if (!dateInput) return undefined; try { let date; if (typeof dateInput === 'string') date = parseISO(dateInput); else if (dateInput instanceof Date) date = dateInput; else return undefined; return isDateValid(date) ? date : undefined; } catch (e) { console.warn("safeParseDate error:", e); return undefined; }
};
// --- End Helpers ---

type DashboardStatsOutput = z.infer<typeof dashboardStatsSchema>;
type ExpenseChartDataOutput = z.infer<typeof expenseChartDataSchema>;
type RevenueChartDataOutput = z.infer<typeof revenueChartDataSchema>;

export const dashboardRouter = router({
    getStats: tenantAdminProcedure // <-- CORRIGIDO: Usa tenantAdminProcedure
        .input(dashboardFilterSchema.optional())
        .output(dashboardStatsSchema)
        .query(async ({ input, ctx }): Promise<DashboardStatsOutput> => { // Adicionado ctx
            // ctx.tenantId e ctx.user são garantidos pelo middleware
            const tenantObjectId = new Types.ObjectId(ctx.tenantId!);
            console.log(`[tRPC dashboard.getStats] Tenant: ${ctx.tenantId!}, Input:`, input);

            try {
                await connectToDatabase();

                // 1. Define Períodos
                const endDate = input?.endDate ? endOfDay(safeParseDate(input.endDate)!) : endOfDay(new Date());
                const startDate = input?.startDate ? startOfDay(safeParseDate(input.startDate)!) : startOfDay(subDays(endDate, 29));
                const empreendimentoIdParam = input?.empreendimentoId;

                if (!isDateValid(startDate) || !isDateValid(endDate) || startDate > endDate) {
                     throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período inválido.' });
                }
                console.log(`[tRPC dashboard.getStats] Período Atual: ${startDate.toISOString()} a ${endDate.toISOString()}`);

                const daysInPeriod = differenceInDays(endDate, startDate) + 1;
                const prevEndDate = endOfDay(subDays(startDate, 1));
                const prevStartDate = startOfDay(subDays(prevEndDate, daysInPeriod - 1));
                console.log(`[tRPC dashboard.getStats] Período Anterior: ${prevStartDate.toISOString()} a ${prevEndDate.toISOString()}`);

                // 2. Filtro Base por Tenant e Empreendimento Opcional
                // *** CORREÇÃO: Adiciona tenantId ao filtro base ***
                const baseTenantFilter: FilterQuery<any> = { tenantId: tenantObjectId };
                const baseEmpFilter: FilterQuery<DespesaDocument> = { ...baseTenantFilter }; // Para Despesas
                const baseEmpOnlyFilter: FilterQuery<any> = { ...baseTenantFilter }; // Para Empreendimento count

                if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
                    const empObjectId = new Types.ObjectId(empreendimentoIdParam);
                    // Adiciona filtro de empreendimento aos filtros que precisam dele
                    baseEmpFilter.empreendimento = empObjectId;
                    baseEmpOnlyFilter._id = empObjectId; // Para contar apenas o empreendimento selecionado
                    console.log(`[tRPC dashboard.getStats] Filtrando pelo empreendimento: ${empreendimentoIdParam}`);
                } else if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
                    console.warn(`[tRPC dashboard.getStats] ID de empreendimento inválido: ${empreendimentoIdParam}. Ignorando filtro de empreendimento.`);
                }

                // --- 3. Agregação Principal (Período ATUAL) ---
                const currentMatchFilter: FilterQuery<DespesaDocument> = {
                    ...baseEmpFilter, // Inclui tenantId e empreendimentoId (se houver)
                    date: { $gte: startDate, $lte: endDate }, // Baseado na DATA DA DESPESA
                };
                console.log("[tRPC dashboard.getStats] Filtro Agregação Atual:", JSON.stringify(currentMatchFilter));
                const currentPeriodPipeline: PipelineStage[] = [ { $match: currentMatchFilter }, { /* ... (group stage) ... */
                     $group: {
                         _id: null,
                         totalAllValue: { $sum: '$value' }, totalAllCount: { $sum: 1 },
                         totalApprovedValue: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Aprovado'] }, '$value', 0] } },
                         totalApprovedCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Aprovado'] }, 1, 0] } },
                         dueValue: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] }] }, '$value', 0] } },
                         dueCount: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] }] }, 1, 0] } },
                         paidValue: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate',endDate] }] }, '$value', 0 ] } },
                         paidCount: { $sum: { $cond: [{ $and: [{ $eq: ['$approvalStatus', 'Aprovado'] }, { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate',endDate] }] }, 1, 0 ] } },
                         pendingApprovalValue: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, '$value', 0] } },
                         pendingApprovalCount: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, 1, 0] } }
                     }
                 } ];
                const currentStatsResult = await Despesa.aggregate(currentPeriodPipeline);
                const currentData = currentStatsResult[0] || { /* ... defaults ... */ };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Atual:", JSON.stringify(currentData));

                // --- 4. Agregação Período ANTERIOR (Comparação) ---
                 const previousMatchFilter: FilterQuery<DespesaDocument> = {
                     ...baseEmpFilter, // Inclui tenantId e empreendimentoId (se houver)
                     approvalStatus: 'Aprovado',
                     date: { $gte: prevStartDate, $lte: prevEndDate },
                 };
                console.log("[tRPC dashboard.getStats] Filtro Agregação Anterior:", JSON.stringify(previousMatchFilter));
                const previousPeriodPipeline: PipelineStage[] = [ { $match: previousMatchFilter }, { /* ... (group stage) ... */
                    $group: {
                         _id: null, totalApprovedValue: { $sum: '$value' },
                         dueValue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', prevStartDate] }, { $lte: ['$dueDate', prevEndDate] }] }, '$value', 0] } },
                         paidValue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', prevStartDate] }, { $lte: ['$dueDate', prevEndDate] }] }, '$value', 0] } },
                         totalAllValue: { $sum: '$value' },
                     }
                 } ];
                const previousStatsResult = await Despesa.aggregate(previousPeriodPipeline);
                const previousData = previousStatsResult[0] || { /* ... defaults ... */ };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Anterior:", JSON.stringify(previousData));

                // --- 5. Cálculo Comparação ---
                const comparisonData = { /* ... (cálculos) ... */
                    totalApprovedChange: calculatePercentageChange(currentData.totalApprovedValue, previousData.totalApprovedValue),
                    dueChange: calculatePercentageChange(currentData.dueValue, previousData.dueValue),
                    paidChange: calculatePercentageChange(currentData.paidValue, previousData.paidValue),
                 };
                console.log("[tRPC dashboard.getStats] Dados Comparação:", comparisonData);

                // --- 6. Cálculo Despesas Próximas (A VENCER) ---
                const todayStart = startOfDay(new Date());
                const upcomingEndDate = endOfDay(addDays(todayStart, 7));
                const upcomingMatchFilter: FilterQuery<DespesaDocument> = {
                    ...baseEmpFilter, // Inclui tenantId e empreendimentoId (se houver)
                    approvalStatus: 'Aprovado',
                    status: 'A vencer',
                    dueDate: { $gte: todayStart, $lte: upcomingEndDate },
                };
                console.log("[tRPC dashboard.getStats] Filtro Próximas Despesas:", JSON.stringify(upcomingMatchFilter));
                const upcomingStatsPipeline: PipelineStage[] = [ { $match: upcomingMatchFilter }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value'} }} ];
                const upcomingStats = await Despesa.aggregate(upcomingStatsPipeline);
                const upcomingExpensesData = upcomingStats[0] || { count: 0, value: 0 };
                console.log("[tRPC dashboard.getStats] Resultado Agregação Próximas:", JSON.stringify(upcomingExpensesData));

                // --- 7. Contagem Total de Empreendimentos ---
                // *** CORREÇÃO: Usa baseEmpOnlyFilter que contém tenantId e opcionalmente _id ***
                const empreendimentosCount = await Empreendimento.countDocuments(baseEmpOnlyFilter);
                console.log(`[tRPC dashboard.getStats] Total Empreendimentos (filtrado): ${empreendimentosCount}`);

                // --- 8. Montagem da Resposta Final ---
                const finalData: DashboardStatsOutput = { /* ... (montagem dos dados como antes) ... */
                     totalEmpreendimentos: empreendimentosCount,
                     currentPeriod: {
                         totalApprovedValue: currentData.totalApprovedValue ?? 0,
                         totalApprovedCount: currentData.totalApprovedCount ?? 0,
                         dueValue: currentData.dueValue ?? 0,
                         dueCount: currentData.dueCount ?? 0,
                         paidValue: currentData.paidValue ?? 0,
                         paidCount: currentData.paidCount ?? 0,
                         totalAllValue: currentData.totalAllValue ?? 0,
                         totalAllCount: currentData.totalAllCount ?? 0,
                     },
                     previousPeriod: {
                         totalApprovedValue: previousData.totalApprovedValue ?? 0,
                         dueValue: previousData.dueValue ?? 0,
                         paidValue: previousData.paidValue ?? 0,
                         totalAllValue: previousData.totalAllValue ?? 0,
                     },
                     comparison: {
                         totalApprovedChange: comparisonData.totalApprovedChange,
                         dueChange: comparisonData.dueChange,
                         paidChange: comparisonData.paidChange,
                     },
                     pendingApproval: {
                         value: currentData.pendingApprovalValue ?? 0,
                         count: currentData.pendingApprovalCount ?? 0
                     },
                     upcomingExpenses: {
                         count: upcomingExpensesData.count ?? 0,
                         value: upcomingExpensesData.value ?? 0,
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

    // --- getExpenseChartData ---
    getExpenseChartData: tenantAdminProcedure // <-- CORRIGIDO: Usa tenantAdminProcedure
        .input(dashboardFilterSchema.optional())
        .output(expenseChartDataSchema)
        .query(async ({ input, ctx }): Promise<ExpenseChartDataOutput> => { // Adicionado ctx
            // ctx.tenantId é garantido pelo middleware
            const tenantObjectId = new Types.ObjectId(ctx.tenantId!);
            console.log(`[tRPC dashboard.getExpenseChartData] Tenant: ${ctx.tenantId!}, Input:`, input);
            try {
                await connectToDatabase();
                const endDate = input?.endDate ? endOfDay(safeParseDate(input.endDate)!) : endOfDay(new Date());
                const defaultStartDate = startOfDay(subDays(endDate, 365));
                const startDate = input?.startDate ? startOfDay(safeParseDate(input.startDate)!) : defaultStartDate;
                const empreendimentoIdParam = input?.empreendimentoId;

                if (!isDateValid(startDate) || !isDateValid(endDate) || startDate > endDate) {
                     throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período inválido para gráfico.' });
                }
                 console.log(`[tRPC dashboard.getExpenseChartData] Período: ${startDate.toISOString()} a ${endDate.toISOString()}`);

                // *** CORREÇÃO: Adiciona tenantId ao filtro ***
                const matchFilter: FilterQuery<DespesaDocument> = {
                    tenantId: tenantObjectId, // Filtra pelo tenant
                    approvalStatus: 'Aprovado',
                    date: { $gte: startDate, $lte: endDate }
                };
                if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
                    matchFilter.empreendimento = new Types.ObjectId(empreendimentoIdParam);
                }
                 console.log("[tRPC dashboard.getExpenseChartData] Filtro:", JSON.stringify(matchFilter));

                // Agregações permanecem as mesmas, mas agora usam o filtro com tenantId
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
            } catch (error: unknown) {
                 console.error("[tRPC dashboard.getExpenseChartData] Erro:", error);
                 const errorMessage = error instanceof Error ? error.message : 'Erro gráfico despesas';
                 throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorMessage });
            }
        }),

    // --- getRevenueChartData (Placeholder) ---
    getRevenueChartData: tenantAdminProcedure // <-- CORRIGIDO: Usa tenantAdminProcedure
        .input(dashboardFilterSchema.optional())
        .output(revenueChartDataSchema)
        .query(async ({ input, ctx }): Promise<RevenueChartDataOutput> => { // Adicionado ctx
            console.warn(`[tRPC dashboard.getRevenueChartData] Rota de receita ainda é mock. Tenant: ${ctx.tenantId!}`);
            await new Promise(res => setTimeout(res, 100));
            const mockRevenue = [ { month: "Jan", value: 15000 }, { month: "Fev", value: 18000 }, { month: "Mar", value: 22000 }, { month: "Abr", value: 19500 }, { month: "Mai", value: 25000 }, { month: "Jun", value: 21000 }, ];
            return revenueChartDataSchema.parse({ byMonth: mockRevenue });
        }),
});

export type DashboardRouter = typeof dashboardRouter;
// ============================================================
// END OF REFACTORED FILE: server/api/routers/dashboard.ts
// ============================================================