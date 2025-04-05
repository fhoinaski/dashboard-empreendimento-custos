// FILE: app/api/despesas/monthly/route.ts (Refatorado)
import { NextResponse } from "next/server";
import mongoose, { PipelineStage, FilterQuery, Types } from "mongoose";
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa } from "@/lib/db/models";
import { getServerSession } from "next-auth/next"; // Importar
import { authOptions } from "@/lib/auth/options"; // Importar

export async function GET(request: Request) {
  try {
    // --- Verificação de Sessão e RBAC ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        console.warn("[API GET /api/despesas/monthly] Acesso não autorizado.");
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userRole = session.user.role;
    const userAssignedEmpreendimentos = (session.user.assignedEmpreendimentos || [])
        .filter(id => mongoose.isValidObjectId(id))
        .map(id => new Types.ObjectId(id));
    // --- Fim Verificação ---

    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const from = new Date(searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1));
    const to = new Date(searchParams.get("to") || new Date());
    const empreendimentoIdParam = searchParams.get("empreendimento");

    // --- Filtro RBAC + Filtros da Requisição ---
    const match: FilterQuery<any> = {
      date: { $gte: from, $lte: to },
      approvalStatus: 'Aprovado' // Apenas despesas aprovadas
    };

    let targetEmpreendimentoId: Types.ObjectId | null = null;
    if (empreendimentoIdParam && empreendimentoIdParam !== "todos") {
        if (!mongoose.isValidObjectId(empreendimentoIdParam)) {
            return NextResponse.json({ error: "ID de empreendimento inválido" }, { status: 400 });
        }
        targetEmpreendimentoId = new Types.ObjectId(empreendimentoIdParam);
    }

    if (userRole === 'admin' || userRole === 'manager') {
        if (targetEmpreendimentoId) {
            match.empreendimento = targetEmpreendimentoId;
        }
    } else if (userRole === 'user') {
        if (targetEmpreendimentoId) {
            if (!userAssignedEmpreendimentos.some(id => id.equals(targetEmpreendimentoId!))) {
                console.warn(`[API GET /api/despesas/monthly] Usuário ${session.user.id} tentou acessar empreendimento ${targetEmpreendimentoId} não atribuído.`);
                return NextResponse.json({ error: 'Acesso negado a este empreendimento' }, { status: 403 });
            }
            match.empreendimento = targetEmpreendimentoId;
        } else {
            match.empreendimento = { $in: userAssignedEmpreendimentos };
        }
    } else {
        return NextResponse.json({ error: 'Permissão inválida' }, { status: 403 });
    }
    // --- Fim Filtro RBAC ---

    const aggregationPipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } },
          total: { $sum: "$value" },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          name: { $let: { vars: { monthsInYear: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] }, in: { $arrayElemAt: [ "$$monthsInYear", { $subtract: ["$_id.month", 1] } ] } } },
          total: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ];

    const despesas = await Despesa.aggregate(aggregationPipeline);

    return NextResponse.json(despesas);

  } catch (error) {
    console.error("[API GET /api/despesas/monthly] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao buscar dados mensais", details: errorMessage }, { status: 500 });
  }
}