// FILE: app/api/despesas/summary/route.ts
// STATUS: MODIFIED TO HANDLE PENDING APPROVAL FILTER

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { PipelineStage, FilterQuery, Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, DespesaDocument } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { startOfDay, endOfDay, subDays } from 'date-fns';

// Interface para o resultado da agregação do Mongoose
interface SummaryAggregationResult {
    _id: null;
    totalValue: number;
    totalPaidValue: number;
    totalPendingValue: number;
    countTotal: number;
    countPaid: number;
    countPending: number;
}

// Interface para o resumo enviado ao cliente
interface DespesaSummary {
    totalValue: number;
    totalPaid: number;
    totalPending: number;
    countTotal: number;
    countPaid: number;
    countPending: number;
}

export async function GET(request: Request) {
    console.log("[API GET /api/despesas/summary] Recebida requisição.");
    try {
        const session = await getServerSession(authOptions);
        // --- RBAC CHECK: ADMIN ONLY ---
        if (!session || session.user.role !== 'admin') {
            console.warn("[API GET /api/despesas/summary] Access denied. Role:", session?.user?.role);
            return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }
        // --- END RBAC CHECK ---

        await connectToDatabase();
        console.log("[API GET /api/despesas/summary] Conectado ao DB.");

        // --- Filter Parsing ---
        const { searchParams } = new URL(request.url);
        const empreendimentoId = searchParams.get('empreendimento');
        const statusParam = searchParams.get('status');
        const categoryParam = searchParams.get('category');
        const searchTerm = searchParams.get('q');
        const approvalStatusParam = searchParams.get('approvalStatus');
        const toParam = searchParams.get("to");
        const fromParam = searchParams.get("from");

        // Definir período padrão (mesmo que o dashboard)
        const endDate = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());
        const startDate = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(subDays(endDate, 29));

        console.log("[API GET /api/despesas/summary] Params Recebidos:", {
            empreendimentoId,
            statusParam,
            categoryParam,
            approvalStatusParam,
            searchTerm,
            from: startDate,
            to: endDate
        });

        // --- Build Filter ---
        const filter: FilterQuery<DespesaDocument> = {
            createdAt: { $gte: startDate, $lte: endDate }, // Filtro de período
        };

        // Só aplicar o filtro de status "Pago" ou "A vencer" se approvalStatus não for "Pendente"
        if (approvalStatusParam !== 'Pendente') {
            filter.status = { $in: ['Pago', 'A vencer'] };
        }

        if (empreendimentoId && empreendimentoId !== 'todos' && mongoose.isValidObjectId(empreendimentoId)) {
            filter.empreendimento = new Types.ObjectId(empreendimentoId);
        }
        if (statusParam && statusParam !== 'todos') {
            filter.status = statusParam;
        }
        if (categoryParam && categoryParam !== 'todos') {
            filter.category = categoryParam;
        }
        if (searchTerm) {
            filter.description = { $regex: searchTerm, $options: 'i' };
        }
        if (approvalStatusParam && approvalStatusParam !== 'todos') {
            filter.approvalStatus = approvalStatusParam;
        }

        console.log("[API GET /api/despesas/summary] Filtro MongoDB a ser aplicado:", JSON.stringify(filter));

        // --- Aggregation Pipeline ---
        const aggregationPipeline: PipelineStage[] = [
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: '$value' },
                    totalPaidValue: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$status', 'Pago'] },
                                    { $gte: ['$dueDate', startDate] },
                                    { $lte: ['$dueDate', endDate] }
                                ]},
                                '$value',
                                0
                            ]
                        }
                    },
                    totalPendingValue: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$status', 'A vencer'] },
                                    { $gte: ['$dueDate', startDate] },
                                    { $lte: ['$dueDate', endDate] }
                                ]},
                                '$value',
                                0
                            ]
                        }
                    },
                    countTotal: { $sum: 1 },
                    countPaid: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$status', 'Pago'] },
                                    { $gte: ['$dueDate', startDate] },
                                    { $lte: ['$dueDate', endDate] }
                                ]},
                                1,
                                0
                            ]
                        }
                    },
                    countPending: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ['$status', 'A vencer'] },
                                    { $gte: ['$dueDate', startDate] },
                                    { $lte: ['$dueDate', endDate] }
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ];

        console.log("[API GET /api/despesas/summary] Executando agregação...");
        const results = await Despesa.aggregate<SummaryAggregationResult>(aggregationPipeline);
        console.log("[API GET /api/despesas/summary] Resultado da agregação:", results);

        // --- Prepare Response ---
        let summary: DespesaSummary;
        if (results.length > 0) {
            const res = results[0];
            summary = {
                totalValue: res.totalValue || 0,
                totalPaid: res.totalPaidValue || 0,
                totalPending: res.totalPendingValue || 0,
                countTotal: res.countTotal || 0,
                countPaid: res.countPaid || 0,
                countPending: res.countPending || 0,
            };
        } else {
            summary = { totalValue: 0, totalPaid: 0, totalPending: 0, countTotal: 0, countPaid: 0, countPending: 0 };
        }

        console.log("[API GET /api/despesas/summary] Enviando resumo:", summary);
        return NextResponse.json(summary);

    } catch (error) {
        console.error('[API GET /api/despesas/summary] Erro:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        const errorSummary: DespesaSummary = { totalValue: 0, totalPaid: 0, totalPending: 0, countTotal: 0, countPaid: 0, countPending: 0 };
        return NextResponse.json(errorSummary, { status: 500 });
    }
}