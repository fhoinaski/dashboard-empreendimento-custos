// app/api/despesas/summary/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { PipelineStage, FilterQuery, Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';

interface SummaryAggregationResult {
    _id: null;
    totalValue: number;
    totalPaidValue: number;
    totalPendingValue: number;
    countTotal: number;
    countPaid: number;
    countPending: number;
}

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
        if (!session?.user?.id) {
            console.warn("[API GET /api/despesas/summary] Não autorizado.");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        await connectToDatabase();
        console.log("[API GET /api/despesas/summary] Conectado ao DB.");

        const { searchParams } = new URL(request.url);
        // **LER OS PARÂMETROS DE FILTRO DA URL**
        const empreendimentoId = searchParams.get('empreendimento');
        const statusParam = searchParams.get('status');
        const categoryParam = searchParams.get('category');
        const searchTerm = searchParams.get('q');

        // Log para verificar os parâmetros recebidos
        console.log("[API GET /api/despesas/summary] Params Recebidos:", { empreendimentoId, statusParam, categoryParam, searchTerm });

        // --- **CONSTRUIR O FILTRO MONGOOSE CORRETAMENTE** ---
        const filter: FilterQuery<typeof Despesa> = {};

        // Aplicar filtro de Empreendimento
        if (empreendimentoId && empreendimentoId !== 'todos') {
            if (mongoose.isValidObjectId(empreendimentoId)) {
                filter.empreendimento = new Types.ObjectId(empreendimentoId);
            } else {
                // ID inválido, logar e ignorar filtro ou retornar erro
                console.warn(`[API GET /api/despesas/summary] ID Empreendimento inválido: ${empreendimentoId}. Ignorando filtro.`);
                 // Pode retornar erro 400 se preferir:
                 // return NextResponse.json({ error: 'ID de empreendimento inválido' }, { status: 400 });
            }
        }

        // Aplicar filtro de Status
        if (statusParam && statusParam !== 'todos') {
             filter.status = statusParam;
             // Se precisar tratar múltiplos status, use searchParams.getAll('status')
             // e filter.status = { $in: statusValues };
        }

        // Aplicar filtro de Categoria
        if (categoryParam && categoryParam !== 'todos') {
            filter.category = categoryParam;
        }

        // Aplicar filtro de Busca (searchTerm) na descrição
        if (searchTerm) {
            filter.description = { $regex: searchTerm, $options: 'i' };
        }
        // Poderia adicionar filtro por usuário aqui se necessário:
        // filter.createdBy = new Types.ObjectId(session.user.id);

        // Log para verificar o filtro final antes da agregação
        console.log("[API GET /api/despesas/summary] Filtro MongoDB a ser aplicado:", JSON.stringify(filter));

        // --- Pipeline de Agregação (Usa o filtro construído) ---
        const aggregationPipeline: PipelineStage[] = [
            // Primeiro estágio: Filtrar documentos
            { $match: filter },
            // Segundo estágio: Agrupar e calcular totais/contagens
            {
                $group: {
                    _id: null, // Agrupar todos os documentos filtrados
                    totalValue: { $sum: '$value' },
                    totalPaidValue: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, '$value', 0] } },
                    totalPendingValue: { $sum: { $cond: [{ $in: ['$status', ['Pendente', 'A vencer']] }, '$value', 0] } },
                    countTotal: { $sum: 1 },
                    countPaid: { $sum: { $cond: [{ $eq: ['$status', 'Pago'] }, 1, 0] } },
                    countPending: { $sum: { $cond: [{ $in: ['$status', ['Pendente', 'A vencer']] }, 1, 0] } }
                }
            }
        ];

        console.log("[API GET /api/despesas/summary] Executando agregação...");
        const results = await Despesa.aggregate<SummaryAggregationResult>(aggregationPipeline);
        console.log("[API GET /api/despesas/summary] Resultado da agregação:", results);

        // --- Preparar Resposta ---
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
            // Se nenhum documento corresponder ao filtro, retorna zero
            summary = { totalValue: 0, totalPaid: 0, totalPending: 0, countTotal: 0, countPaid: 0, countPending: 0 };
        }

        console.log("[API GET /api/despesas/summary] Enviando resumo:", summary);
        return NextResponse.json(summary);

    } catch (error) {
        console.error('[API GET /api/despesas/summary] Erro:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao calcular resumo';
        const errorSummary: DespesaSummary = { totalValue: 0, totalPaid: 0, totalPending: 0, countTotal: 0, countPaid: 0, countPending: 0 };
        // Retornar 500 indica erro interno
        return NextResponse.json(errorSummary, { status: 500 });
    }
}