/* ================================== */
/*       app/api/dashboard/route.ts     */
/* ================================== */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth/next';
import connectToDatabase from "@/lib/db/mongodb";
import { Empreendimento, Despesa } from "@/lib/db/models";
import { authOptions } from '@/lib/auth/options';
import mongoose, { PipelineStage, FilterQuery } from "mongoose";
import { startOfDay, endOfDay, subDays, differenceInDays, addDays } from 'date-fns';

// Interface Atualizada para incluir totalAllValue/Count
interface DashboardData {
    totalEmpreendimentos: number;
    currentPeriod: {
        totalApprovedValue: number; totalApprovedCount: number;
        dueValue: number; dueCount: number;
        paidValue: number; paidCount: number;
        totalAllValue: number; totalAllCount: number; // <- NOVO: Total geral registrado no período
    };
    previousPeriod?: {
        totalApprovedValue: number; dueValue: number; paidValue: number;
        totalAllValue: number; // <- NOVO: Total geral do período anterior para comparação opcional
    };
    comparison?: {
        totalApprovedChange: number | null;
        dueChange: number | null;
        paidChange: number | null;
        // Poderia adicionar comparação para totalAllChange se necessário
    };
    pendingApproval?: { count: number; value: number };
    upcomingExpenses?: { count: number; value: number; };
}

// Função auxiliar (sem alterações)
function calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }
        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const toParam = searchParams.get("to");
        const fromParam = searchParams.get("from");
        const empreendimentoIdParam = searchParams.get("empreendimentoId");

        const endDate = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());
        const startDate = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(subDays(endDate, 29));

        // Filtro Base por Empreendimento
        const baseEmpreendimentoFilter: FilterQuery<any> = {};
        if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && mongoose.isValidObjectId(empreendimentoIdParam)) {
            baseEmpreendimentoFilter.empreendimento = new mongoose.Types.ObjectId(empreendimentoIdParam);
        } else if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
            console.warn(`API GET /api/dashboard: ID de empreendimento inválido: ${empreendimentoIdParam}`);
        }

        // Agregação Principal (Calcula múltiplos valores em uma passagem)
        const currentPeriodStats = await Despesa.aggregate([
            {
                $match: { // Filtro inicial amplo por data de CRIAÇÃO e empreendimento
                    createdAt: { $gte: startDate, $lte: endDate }, // Alterado de 'date' para 'createdAt'
                    ...baseEmpreendimentoFilter
                }
            },
            {
                $group: {
                    _id: null,

                    // 1. Soma TOTAL (Independente de status/aprovação/vencimento)
                    totalAllValue: { $sum: '$value' },
                    totalAllCount: { $sum: 1 },

                    // 2. Soma APROVADAS (Pago ou A Vencer) COM VENCIMENTO no período
                    totalApprovedValue: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $in: ['$status', ['Pago', 'A vencer']] },
                                    { $gte: ['$dueDate', startDate] },
                                    { $lte: ['$dueDate', endDate] }
                                ]},
                                '$value',
                                0
                            ]
                        }
                    },
                    totalApprovedCount: {
                        $sum: { $cond: [ { $and: [ { $in: ['$status', ['Pago', 'A vencer']] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] } ] }, 1, 0 ] }
                    },

                    // 3. Soma A VENCER (Aprovadas) COM VENCIMENTO no período
                    dueValue: {
                        $sum: { $cond: [ { $and: [ { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] } ] }, '$value', 0 ] }
                    },
                    dueCount: {
                        $sum: { $cond: [ { $and: [ { $eq: ['$status', 'A vencer'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] } ] }, 1, 0 ] }
                    },

                    // 4. Soma PAGAS (Aprovadas) COM VENCIMENTO no período
                    paidValue: {
                        $sum: { $cond: [ { $and: [ { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] } ] }, '$value', 0 ] }
                    },
                    paidCount: {
                        $sum: { $cond: [ { $and: [ { $eq: ['$status', 'Pago'] }, { $gte: ['$dueDate', startDate] }, { $lte: ['$dueDate', endDate] } ] }, 1, 0 ] }
                    },

                    // 5. Soma AGUARDANDO APROVAÇÃO (criadas no período)
                    pendingApprovalValue: {
                        $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, '$value', 0 ] }
                    },
                    pendingApprovalCount: {
                        $sum: { $cond: [{ $eq: ['$approvalStatus', 'Pendente'] }, 1, 0 ] }
                    }
                }
            }
        ]);

        const currentPeriodData = currentPeriodStats[0] || {
            totalApprovedValue: 0, totalApprovedCount: 0, dueValue: 0, dueCount: 0,
            paidValue: 0, paidCount: 0, totalAllValue: 0, totalAllCount: 0,
            pendingApprovalValue: 0, pendingApprovalCount: 0
        };

        // Cálculo Período Anterior (Comparação APROVADAS por VENCIMENTO)
        const daysInPeriod = differenceInDays(endDate, startDate) + 1;
        const prevEndDate = subDays(startDate, 1);
        const prevStartDate = subDays(prevEndDate, daysInPeriod - 1);

        const previousMatchFilter: FilterQuery<any> = {
            dueDate: { $gte: prevStartDate, $lte: prevEndDate },
            status: { $in: ['Pago', 'A vencer'] },
            ...baseEmpreendimentoFilter
        };

        const previousStats = await Despesa.aggregate([
            { $match: previousMatchFilter },
            { $group: {
                _id: null,
                totalApprovedValue: { $sum: '$value' },
                dueValue: { $sum: { $cond: [{ $eq: ['$status', 'A vencer'] }, '$value', 0] } },
                paidValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } },
            }}
        ]);
        const previousPeriodData = previousStats[0] || { totalApprovedValue: 0, dueValue: 0, paidValue: 0, totalAllValue: 0 };

        const comparisonData = {
            totalApprovedChange: calculatePercentageChange(currentPeriodData.totalApprovedValue, previousPeriodData.totalApprovedValue),
            dueChange: calculatePercentageChange(currentPeriodData.dueValue, previousPeriodData.dueValue),
            paidChange: calculatePercentageChange(currentPeriodData.paidValue, previousPeriodData.paidValue),
        };

        // Cálculo das Despesas A Vencer Próximas
        const todayStart = startOfDay(new Date());
        const upcomingEndDate = endOfDay(addDays(todayStart, 7));
        const upcomingMatchFilter: FilterQuery<any> = {
            status: 'A vencer', dueDate: { $gte: todayStart, $lte: upcomingEndDate },
            ...baseEmpreendimentoFilter
        };
        const upcomingStats = await Despesa.aggregate([
            { $match: upcomingMatchFilter },
            { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$value'} }}
        ]);
        const upcomingExpensesData = upcomingStats[0] || { count: 0, value: 0 };

        // Contagem Total de Empreendimentos
        const empreendimentosCount = await Empreendimento.countDocuments(
            baseEmpreendimentoFilter.empreendimento ? { _id: baseEmpreendimentoFilter.empreendimento } : {}
        );

        // Montagem da Resposta Final
        const data: DashboardData = {
            totalEmpreendimentos: empreendimentosCount,
            currentPeriod: {
                totalApprovedValue: currentPeriodData.totalApprovedValue,
                totalApprovedCount: currentPeriodData.totalApprovedCount,
                dueValue: currentPeriodData.dueValue,
                dueCount: currentPeriodData.dueCount,
                paidValue: currentPeriodData.paidValue,
                paidCount: currentPeriodData.paidCount,
                totalAllValue: currentPeriodData.totalAllValue,
                totalAllCount: currentPeriodData.totalAllCount,
            },
            previousPeriod: {
                totalApprovedValue: previousPeriodData.totalApprovedValue,
                dueValue: previousPeriodData.dueValue,
                paidValue: previousPeriodData.paidValue,
                totalAllValue: previousPeriodData.totalAllValue,
            },
            comparison: comparisonData,
            pendingApproval: {
                value: currentPeriodData.pendingApprovalValue,
                count: currentPeriodData.pendingApprovalCount
            },
            upcomingExpenses: upcomingExpensesData,
        };

        return NextResponse.json(data);

    } catch (error: unknown) {
        console.error("Erro em API GET /api/dashboard:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: "Erro Interno do Servidor", details: errorMessage }, { status: 500 });
    }
}