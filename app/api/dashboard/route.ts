// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth/next';
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Despesa } from "@/lib/db/models";
import { authOptions } from '@/lib/auth/options';
import mongoose, { PipelineStage, FilterQuery } from "mongoose"; // Importar tipos
import { startOfDay, endOfDay, subDays, differenceInDays, addDays } from 'date-fns';

// ... (interfaces DashboardData, calculatePercentageChange - inalteradas) ...
interface DashboardData {
  totalEmpreendimentos: number;
  currentPeriod: {
    despesasPendentes: number;
    despesasPendentesCount: number;
    despesasPagas: number;
    despesasPagasCount: number;
    totalDespesas: number;
    totalDespesasCount: number;
  };
  previousPeriod?: {
    totalDespesas: number;
    despesasPendentes: number;
    despesasPagas: number;
  };
  comparison?: {
    totalDespesasChange: number | null;
    despesasPendentesChange: number | null;
    despesasPagasChange: number | null;
  };
  upcomingExpenses?: {
      count: number;
      value: number;
  };
}

function calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
}


export async function GET(request: NextRequest) {
    console.log("API GET /api/dashboard chamado");
    try {
        // const session = await getServerSession(authOptions);
        // if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        await connectToDatabase();
        console.log("API GET /api/dashboard: Conectado DB.");

        const { searchParams } = new URL(request.url);
        const toParam = searchParams.get("to");
        const fromParam = searchParams.get("from");
        const empreendimentoIdParam = searchParams.get("empreendimentoId"); // <-- NOVO: Ler ID do empreendimento

        const endDate = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());
        const startDate = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(subDays(endDate, 29));

        console.log(`API GET /api/dashboard: Período: ${startDate.toISOString()} a ${endDate.toISOString()}`);
        if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
             console.log(`API GET /api/dashboard: Filtrando pelo Empreendimento ID: ${empreendimentoIdParam}`);
        }

        // --- Construir Filtro Base ---
        const baseMatchFilter: FilterQuery<any> = { // Tipagem mais genérica para $match
            // Usar 'dueDate' ou 'date'? Vamos usar dueDate para focar em vencimentos/pagamentos
            dueDate: { $gte: startDate, $lte: endDate },
        };
        // Adicionar filtro de empreendimento SE fornecido e válido
        if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
            baseMatchFilter.empreendimento = new mongoose.Types.ObjectId(empreendimentoIdParam);
        } else if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
             console.warn(`API GET /api/dashboard: ID de empreendimento inválido recebido: ${empreendimentoIdParam}`);
             // Opcional: retornar erro 400 ou simplesmente ignorar o filtro inválido
             // return NextResponse.json({ error: "ID de empreendimento inválido" }, { status: 400 });
        }

        // --- Buscar Dados do Período Atual com Filtro ---
        const [empreendimentosCount, currentStats] = await Promise.all([
             // Contagem total não é afetada pelo filtro de despesa
            Empreendimento.countDocuments(),
            Despesa.aggregate([
                { $match: baseMatchFilter }, // <-- Usa o filtro base (com ou sem empreendimento)
                {
                    $group: {
                        _id: null,
                        totalDespesasValue: { $sum: '$value' },
                        totalDespesasCount: { $sum: 1 },
                        despesasPendentesValue: { $sum: { $cond: [{ $in: ['$status', ['Pendente', 'A vencer']] }, '$value', 0] } },
                        despesasPendentesCount: { $sum: { $cond: [{ $in: ['$status', ['Pendente', 'A vencer']] }, 1, 0] } },
                        despesasPagasValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } },
                        despesasPagasCount: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const currentPeriodData = currentStats[0] || {
            totalDespesasValue: 0, totalDespesasCount: 0, despesasPendentesValue: 0,
            despesasPendentesCount: 0, despesasPagasValue: 0, despesasPagasCount: 0,
        };

        // --- (OPCIONAL) Buscar Dados do Período Anterior com Filtro ---
        const daysInPeriod = differenceInDays(endDate, startDate) + 1;
        const prevEndDate = subDays(startDate, 1);
        const prevStartDate = subDays(prevEndDate, daysInPeriod - 1);

        // Criar filtro para período anterior (também inclui empreendimento se selecionado)
        const previousMatchFilter: FilterQuery<any> = {
             dueDate: { $gte: prevStartDate, $lte: prevEndDate },
             ...(baseMatchFilter.empreendimento && { empreendimento: baseMatchFilter.empreendimento }) // Reaplica filtro de empreendimento
        };

        const previousStats = await Despesa.aggregate([
             { $match: previousMatchFilter }, // <-- Usa o filtro do período anterior
             { $group: {
                  _id: null,
                  totalDespesasValue: { $sum: '$value' },
                  despesasPendentesValue: { $sum: { $cond: [{ $in: ['$status', ['Pendente', 'A vencer']] }, '$value', 0] } },
                  despesasPagasValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } },
               }
             }
        ]);

        const previousPeriodData = previousStats[0] || { totalDespesasValue: 0, despesasPendentesValue: 0, despesasPagasValue: 0 };

        const comparisonData = {
            totalDespesasChange: calculatePercentageChange(currentPeriodData.totalDespesasValue, previousPeriodData.totalDespesasValue),
            despesasPendentesChange: calculatePercentageChange(currentPeriodData.despesasPendentesValue, previousPeriodData.despesasPendentesValue),
            despesasPagasChange: calculatePercentageChange(currentPeriodData.despesasPagasValue, previousPeriodData.despesasPagasValue),
        };

         // --- (OPCIONAL) Buscar Próximos Vencimentos (considera filtro de empreendimento) ---
         const todayStart = startOfDay(new Date());
         const upcomingEndDate = endOfDay(addDays(todayStart, 7));
         const upcomingMatchFilter: FilterQuery<any> = {
             status: { $in: ['Pendente', 'A vencer'] },
             dueDate: { $gte: todayStart, $lte: upcomingEndDate },
             ...(baseMatchFilter.empreendimento && { empreendimento: baseMatchFilter.empreendimento }) // Reaplica filtro de empreendimento
         };
         const upcomingStats = await Despesa.aggregate([
              { $match: upcomingMatchFilter },
              { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value'} }}
         ]);
         const upcomingExpensesData = upcomingStats[0] || { count: 0, value: 0 };

        // --- Montar Resposta Final ---
        const data: DashboardData = {
            totalEmpreendimentos: empreendimentosCount,
            currentPeriod: {
                totalDespesas: currentPeriodData.totalDespesasValue,
                totalDespesasCount: currentPeriodData.totalDespesasCount,
                despesasPendentes: currentPeriodData.despesasPendentesValue,
                despesasPendentesCount: currentPeriodData.despesasPendentesCount,
                despesasPagas: currentPeriodData.despesasPagasValue,
                despesasPagasCount: currentPeriodData.despesasPagasCount,
            },
            previousPeriod: {
                 totalDespesas: previousPeriodData.totalDespesasValue,
                 despesasPendentes: previousPeriodData.despesasPendentesValue,
                 despesasPagas: previousPeriodData.despesasPagasValue,
            },
            comparison: comparisonData,
            upcomingExpenses: upcomingExpensesData,
        };
        console.log("API GET /api/dashboard: Dados preparados (com filtro? ", !!baseMatchFilter.empreendimento, "):", data);
        return NextResponse.json(data);

    } catch (error: unknown) {
        console.error("Erro em API GET /api/dashboard:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: "Erro Interno do Servidor", details: errorMessage }, { status: 500 });
    }
}