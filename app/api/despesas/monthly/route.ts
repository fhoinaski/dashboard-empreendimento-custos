// app/api/despesas/monthly/route.ts
import { NextResponse } from "next/server";
import mongoose, { PipelineStage, FilterQuery } from "mongoose"; // Importar tipos
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa } from "@/lib/db/models";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const from = new Date(searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1));
    const to = new Date(searchParams.get("to") || new Date());
    const empreendimentoId = searchParams.get("empreendimento"); // <-- NOVO: Ler ID

    // Filtro base por data
    const match: FilterQuery<any> = { // Tipagem mais genérica
      date: { $gte: from, $lte: to },
    };

    // Adicionar filtro de empreendimento SE fornecido e válido
    if (empreendimentoId && empreendimentoId !== "todos" && mongoose.isValidObjectId(empreendimentoId)) {
        console.log(`API GET /api/despesas/monthly: Filtrando por Empreendimento ID: ${empreendimentoId}`);
        match.empreendimento = new mongoose.Types.ObjectId(empreendimentoId);
    } else if (empreendimentoId && empreendimentoId !== "todos") {
        console.warn(`API GET /api/despesas/monthly: ID de empreendimento inválido: ${empreendimentoId}`);
        // Opcional: retornar erro 400 ou ignorar filtro inválido
    }

    const aggregationPipeline: PipelineStage[] = [
      { $match: match }, // <-- Usa o filtro (com ou sem empreendimento)
      {
        $group: {
          _id: { month: { $month: "$date" }, year: { $year: "$date" } }, // Agrupar por ano e mês
          total: { $sum: "$value" },
        },
      },
      {
        $project: {
          _id: 0, // Remover _id composto
          year: "$_id.year",
          month: "$_id.month",
          name: { // Mapear mês para nome abreviado
            $let: {
               vars: { monthsInYear: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] },
               in: { $arrayElemAt: [ "$$monthsInYear", { $subtract: ["$_id.month", 1] } ] }
            }
          },
          total: 1,
        },
      },
      { $sort: { year: 1, month: 1 } }, // Ordenar por ano e depois por mês
    ];

    const despesas = await Despesa.aggregate(aggregationPipeline);

    // Garantir que todos os meses do período sejam retornados (Lógica precisa ser ajustada para range dinâmico)
    // Esta lógica simples de allMonths não funciona bem com filtros de data.
    // Uma abordagem melhor seria gerar os meses esperados com base no `from` e `to`
    // e preencher os dados faltantes. Por simplicidade, vamos retornar o que a query der por enquanto.
    // const allMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    // const result = allMonths.map((month) => {
    //   const found = despesas.find((d) => d.name === month);
    //   return found || { name: month, total: 0 };
    // });

    return NextResponse.json(despesas); // Retorna os dados agregados diretamente

  } catch (error) {
    console.error("Erro ao buscar despesas mensais:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao buscar dados mensais", details: errorMessage }, { status: 500 });
  }
}