// server/api/routers/relatorios.ts
import { router, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, DespesaDocument } from '@/lib/db/models';
import mongoose, { Types, FilterQuery, PipelineStage } from 'mongoose';
import { startOfDay, endOfDay, subMonths, parseISO, isValid as isDateValid, differenceInMonths } from 'date-fns';
import {
    relatorioFilterSchema,
    kpiSchema,
    orcamentoSchema,
    tendenciasSchema,
    despesasPorCategoriaSchema,
    despesasPorMesSchema,
    comparativoPeriodoSchema,
    exportarRelatorioSchema,
    exportarRelatorioResponseSchema,
    type KpiOutput,
    type OrcamentoOutput,
    type TendenciasOutput,
    type DespesasPorCategoriaOutput,
    type DespesasPorMesOutput,
    type ComparativoPeriodoOutput,
    type ExportarRelatorioResponse,
    type RelatorioFilterInput
} from '../schemas/relatorios';
import type { Context } from '../context';
import { z } from 'zod'; // Ensure Zod is imported if not already

// Helper function (Make sure this is the one being used)
function calculatePercentageChange(current: number | null, previous: number | null): number | null {
    const currentVal = typeof current === 'number' ? current : 0;
    const previousVal = typeof previous === 'number' ? previous : 0;

    if (previousVal === 0 && currentVal === 0) return 0;
    if (previousVal === 0) return currentVal > 0 ? Infinity : null; // Use Infinity for division by zero when current is positive
    const change = ((currentVal - previousVal) / previousVal) * 100;
    if (!isFinite(change)) { // Check for NaN or calculation resulting in Infinity/-Infinity
        return change > 0 ? Infinity : (change < 0 ? -Infinity : 0); // Return Infinity/-Infinity explicitly
    }
    return change;
}


// Helper buildRelatorioFilter (remains the same)
const buildRelatorioFilter = (input: RelatorioFilterInput, ctxUser: Context['user']): FilterQuery<DespesaDocument> => {
    if (!ctxUser || ctxUser.role !== 'admin') { throw new TRPCError({ code: 'FORBIDDEN' }); }
    const filter: FilterQuery<DespesaDocument> = { approvalStatus: 'Aprovado' };
    const { startDate, endDate, empreendimentoId } = input;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas devem ser strings ISO.' }); }
    const parsedStartDate = startOfDay(parseISO(startDate)); const parsedEndDate = endOfDay(parseISO(endDate));
    if (!isDateValid(parsedStartDate) || !isDateValid(parsedEndDate) || parsedStartDate > parsedEndDate) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período inválido.' }); }
    filter.date = { $gte: parsedStartDate, $lte: parsedEndDate };
    if (empreendimentoId && empreendimentoId !== 'todos' && mongoose.isValidObjectId(empreendimentoId)) { filter.empreendimento = new Types.ObjectId(empreendimentoId); }
    else if (empreendimentoId && empreendimentoId !== 'todos') { console.warn(`[buildRelatorioFilter] Invalid empreendimentoId: ${empreendimentoId}. Ignorando.`); }
    console.log("[buildRelatorioFilter] Final Filter:", JSON.stringify(filter)); return filter;
};
// Other helpers fetchDespesasPorMesData, fetchDespesasPorCategoriaData remain the same

async function fetchDespesasPorMesData(filter: FilterQuery<DespesaDocument>): Promise<{ nome: string; valor: number }[]> {
    const monthlyStats = await Despesa.aggregate([
        { $match: filter },
        { $group: { _id: { month: { $month: "$date" }, year: { $year: "$date" } }, totalValue: { $sum: '$value' } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $project: { _id: 0, nome: { $concat: [{ $arrayElemAt: [["Inv", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], "$_id.month"] }, "/", { $substr: [{ $toString: "$_id.year" }, 2, 2] }] }, valor: "$totalValue" } }
    ]);
    return monthlyStats.map(item => ({
        nome: item.nome,
        valor: typeof item.valor === 'number' ? item.valor : 0
    }));
}
async function fetchDespesasPorCategoriaData(filter: FilterQuery<DespesaDocument>): Promise<{ category: string; value: number }[]> {
     const categoryStats = await Despesa.aggregate([
        { $match: filter },
        { $group: { _id: '$category', totalValue: { $sum: '$value' } } },
        { $project: { _id: 0, category: '$_id', value: '$totalValue' } }
    ]);
    return categoryStats.map(item => ({
        category: item.category,
        value: typeof item.value === 'number' ? item.value : 0
    }));
}


export const relatoriosRouter = router({
    // ... (getDespesasPorMes, getDespesasPorCategoria, getKpis, getOrcamento) ...
    getDespesasPorMes: adminProcedure
        .input(relatorioFilterSchema)
        .output(despesasPorMesSchema)
        .query(async ({ input, ctx }): Promise<DespesasPorMesOutput> => {
             // Add internal validation
            if (!input?.startDate || !input?.endDate) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas são obrigatórias.' });
            }
            try {
                await connectToDatabase();
                const filter = buildRelatorioFilter(input, ctx.user);
                const monthlyStats = await fetchDespesasPorMesData(filter);
                let maiorPeriodo: { nome: string; valor: number } | null = null;
                if (monthlyStats.length > 0) {
                    maiorPeriodo = monthlyStats.reduce((max, item) => (item.valor > max.valor ? item : max), { nome: 'N/A', valor: -Infinity });
                    if (maiorPeriodo.valor <= 0 || !isFinite(maiorPeriodo.valor)) maiorPeriodo = null; // Ensure valid max
                }
                return { periodos: monthlyStats, maiorPeriodo };
            } catch (error) { console.error('Erro getDespesasPorMes:', error); if(error instanceof TRPCError) throw error; throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar despesas por mês' }); }
        }),

    getDespesasPorCategoria: adminProcedure
        .input(relatorioFilterSchema)
        .output(despesasPorCategoriaSchema)
        .query(async ({ input, ctx }): Promise<DespesasPorCategoriaOutput> => {
             // Add internal validation
            if (!input?.startDate || !input?.endDate) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas são obrigatórias.' });
            }
            try {
                await connectToDatabase();
                const filter = buildRelatorioFilter(input, ctx.user);
                const categoryStats = await fetchDespesasPorCategoriaData(filter);
                const categorias: Record<string, number> = {};
                let maiorValor = 0; let maiorNome: string | null = null;
                categoryStats.forEach(item => {
                    categorias[item.category] = item.value;
                    if (item.value > maiorValor) { maiorValor = item.value; maiorNome = item.category; }
                });
                 const finalMaiorCategoria = (maiorNome && maiorValor > 0) ? { nome: maiorNome, valor: maiorValor } : null;
                return { categorias, maiorCategoria: finalMaiorCategoria };
            } catch (error) { console.error('Erro getDespesasPorCategoria:', error); if(error instanceof TRPCError) throw error; throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar despesas por categoria' }); }
        }),

     getKpis: adminProcedure
        .input(relatorioFilterSchema)
        .output(kpiSchema)
        .query(async ({ input, ctx }): Promise<KpiOutput> => {
             // Add internal validation
            if (!input?.startDate || !input?.endDate) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas são obrigatórias.' });
            }
            try {
                await connectToDatabase();
                const filter = buildRelatorioFilter(input, ctx.user);
                const [monthlyData, categoryData] = await Promise.all([ fetchDespesasPorMesData(filter), fetchDespesasPorCategoriaData(filter) ]);
                const totalDespesas = categoryData.reduce((sum, item) => sum + item.value, 0);
                const mediaMensal = monthlyData.length > 0 ? monthlyData.reduce((sum, item) => sum + item.valor, 0) / monthlyData.length : 0;
                let mesPico: { nome: string; valor: number } | null = null;
                if (monthlyData.length > 0) { mesPico = monthlyData.reduce((max, item) => (item.valor > max.valor ? item : max), { nome: 'N/A', valor: -Infinity }); if(mesPico.valor <= 0 || !isFinite(mesPico.valor)) mesPico = null;}
                let categoriaPico: { nome: string; valor: number } | null = null;
                if (categoryData.length > 0) { const maxCat = categoryData.reduce((max, item) => (item.value > max.value ? item : max), { category: 'N/A', value: -Infinity }); if(maxCat.value > 0 && isFinite(maxCat.value)) categoriaPico = { nome: maxCat.category, valor: maxCat.value }; }
                let crescimentoUltimoMes: number | null = null;
                if (monthlyData.length >= 2) { const ultimo = monthlyData[monthlyData.length - 1].valor; const penultimo = monthlyData[monthlyData.length - 2].valor; crescimentoUltimoMes = calculatePercentageChange(ultimo, penultimo); }
                let tendenciaGeral: 'aumento' | 'estavel' | 'queda' = 'estavel';
                if (monthlyData.length >= 3) { const lastThree = monthlyData.slice(-3).map(m => m.valor); if (lastThree[2] > lastThree[1] && lastThree[1] > lastThree[0]) { tendenciaGeral = 'aumento'; } else if (lastThree[2] < lastThree[1] && lastThree[1] < lastThree[0]) { tendenciaGeral = 'queda'; } }
                return { totalDespesas, mediaMensal, mesPico, categoriaPico, crescimentoUltimoMes, tendenciaGeral };
            } catch (error) { console.error('Erro getKpis:', error); if(error instanceof TRPCError) throw error; throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar KPIs' }); }
        }),

     getOrcamento: adminProcedure
        .input(relatorioFilterSchema.pick({ empreendimentoId: true }).optional()) // Make input optional if it's truly just for filtering
        .output(orcamentoSchema)
        .query(async ({ input }): Promise<OrcamentoOutput> => {
            // Placeholder logic remains
            console.log("[getOrcamento] Simulado. Empreendimento:", input?.empreendimentoId);
            await new Promise(res => setTimeout(res, 50));
            const total = input?.empreendimentoId && input.empreendimentoId !== 'todos' ? 50000 : 150000;
            return { total };
        }),

    // --- getTendencia (CORRIGIDO: Usa helper e default para schema) ---
    getTendencia: adminProcedure
        .input(relatorioFilterSchema)
        .output(tendenciasSchema)
        .query(async ({ input, ctx }): Promise<TendenciasOutput> => {
            if (!input?.startDate || !input?.endDate) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas são obrigatórias.' });
            }
            try {
                await connectToDatabase();
                const endDate = parseISO(input.endDate);
                const fourMonthsAgo = startOfDay(subMonths(endDate, 3));
                if (!isDateValid(endDate) || !isDateValid(fourMonthsAgo)) {
                    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Data final inválida para cálculo de tendência.' });
                }
                const filter4Months = buildRelatorioFilter({ ...input, startDate: fourMonthsAgo.toISOString(), endDate: input.endDate }, ctx.user);
                const monthlyStats4 = await fetchDespesasPorMesData(filter4Months);
                const values = monthlyStats4.map(m => m.valor);

                const lastThreeValues = values.slice(-3);
                const mediaTrimestral = lastThreeValues.length > 0 ? lastThreeValues.reduce((sum, v) => sum + v, 0) / lastThreeValues.length : 0;

                const lastTwoValues = values.slice(-2);
                const previsaoProximoMes = lastTwoValues.length > 0 ? lastTwoValues.reduce((sum, v) => sum + v, 0) / lastTwoValues.length : 0;

                let percentualCrescimentoCalc: number | null = null; // Variable to hold calculation result (can be null)
                if (values.length >= 2) {
                    const ultimo = values[values.length - 1];
                    const penultimo = values[values.length - 2];
                    percentualCrescimentoCalc = calculatePercentageChange(ultimo, penultimo);
                }

                // *** FIX: Handle null before returning, use default from schema (0) ***
                const finalPercentualCrescimento = (typeof percentualCrescimentoCalc === 'number' && isFinite(percentualCrescimentoCalc)) ? percentualCrescimentoCalc : 0;

                let tendencia: 'aumento' | 'estavel' | 'queda' = 'estavel';
                if (lastThreeValues.length === 3) {
                    if (lastThreeValues[2] > lastThreeValues[1] && lastThreeValues[1] > lastThreeValues[0]) { tendencia = 'aumento'; }
                    else if (lastThreeValues[2] < lastThreeValues[1] && lastThreeValues[1] < lastThreeValues[0]) { tendencia = 'queda'; }
                }

                return {
                    mediaTrimestral,
                    previsaoProximoMes,
                    percentualCrescimento: finalPercentualCrescimento, // Assign the handled value
                    tendencia
                };

            } catch (error) {
                console.error('Erro getTendencia:', error);
                if(error instanceof TRPCError) throw error;
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar tendências' });
            }
        }),

    // --- getComparativoPeriodo (Keep internal validation) ---
    getComparativoPeriodo: adminProcedure
        .input(relatorioFilterSchema) // Input schema requires dates
        .output(comparativoPeriodoSchema)
        .query(async ({ input, ctx }): Promise<ComparativoPeriodoOutput> => {
            if (!input?.startDate || !input?.endDate) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas de início e fim são obrigatórias.' });
            }
            try {
                await connectToDatabase();
                const filterAtual = buildRelatorioFilter(input, ctx.user);
                const currentData = await fetchDespesasPorMesData(filterAtual);
                const startDateAtual = parseISO(input.startDate); const endDateAtual = parseISO(input.endDate);
                if (!isDateValid(startDateAtual) || !isDateValid(endDateAtual)) { throw new TRPCError({ code: 'BAD_REQUEST', message: 'Datas do período atual inválidas.' }); }
                const diff = differenceInMonths(endDateAtual, startDateAtual);
                const startDateAnterior = subMonths(startDateAtual, diff + 1); const endDateAnterior = endOfDay(subMonths(endDateAtual, diff + 1));
                if (!isDateValid(startDateAnterior) || !isDateValid(endDateAnterior)) { throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao calcular período anterior.' }); }
                const inputAnterior: RelatorioFilterInput = { ...input, startDate: startDateAnterior.toISOString(), endDate: endDateAnterior.toISOString() };
                const filterAnterior = buildRelatorioFilter(inputAnterior, ctx.user);
                const previousData = await fetchDespesasPorMesData(filterAnterior);
                const periodosMap = new Map<string, { atual: number | null; anterior: number | null }>(); const allPeriodNames = new Set<string>(); [...previousData, ...currentData].forEach(p => allPeriodNames.add(p.nome));
                 const sortedPeriodNames = Array.from(allPeriodNames).sort((a, b) => {
                     const [mesA, anoA] = a.split('/'); const [mesB, anoB] = b.split('/');
                     const monthNames = ["Inv", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                     const yearA = parseInt(anoA, 10) + 2000; const yearB = parseInt(anoB, 10) + 2000;
                     const monthIndexA = monthNames.indexOf(mesA); const monthIndexB = monthNames.indexOf(mesB);
                     if(isNaN(yearA) || isNaN(yearB) || monthIndexA < 1 || monthIndexB < 1) return 0;
                     const dateA = new Date(yearA, monthIndexA - 1); const dateB = new Date(yearB, monthIndexB - 1);
                     if (!isDateValid(dateA) || !isDateValid(dateB)) return 0;
                     return dateA.getTime() - dateB.getTime();
                 });
                sortedPeriodNames.forEach(nome => { periodosMap.set(nome, { atual: currentData.find(p => p.nome === nome)?.valor ?? null, anterior: previousData.find(p => p.nome === nome)?.valor ?? null }); });
                const combinedPeriodos = Array.from(periodosMap.entries()).map(([nome, values]) => ({ nome, atual: values.atual, anterior: values.anterior, }));
                const totalAtual = currentData.reduce((sum, p) => sum + p.valor, 0); const totalAnterior = previousData.reduce((sum, p) => sum + p.valor, 0);
                let variacaoTotalPercentual = calculatePercentageChange(totalAtual, totalAnterior);
                return { periodos: combinedPeriodos, variacaoTotalPercentual };
            } catch (error) { if (error instanceof TRPCError) throw error; console.error('Erro getComparativoPeriodo:', error); throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao buscar comparativo' }); }
        }),

    // --- Exportação (Remains Placeholder) ---
    exportarRelatorio: adminProcedure
        .input(exportarRelatorioSchema)
        .mutation(async ({ input }): Promise<ExportarRelatorioResponse> => {
            console.warn("PROCEDIMENTO EXPORTAR NÃO IMPLEMENTADO NO BACKEND");
            console.log("Input recebido para exportação:", input);
            await new Promise(res => setTimeout(res, 500));
            return { success: false, message: "Funcionalidade de exportação não implementada." };
        }),
});

export type RelatoriosRouter = typeof relatoriosRouter;