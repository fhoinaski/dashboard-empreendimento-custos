import { NextResponse } from "next/server";
import mongoose, { PipelineStage } from "mongoose"; // Importar PipelineStage
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa } from "@/lib/db/models";

// Revalida o cache a cada 10 minutos (600 segundos)
export const revalidate = 600;

interface CategoryResult {
    name: string;
    value: number;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const empreendimento = searchParams.get("empreendimento");

    // Validar e definir datas padrão de forma segura
    const fromDate = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = toParam ? new Date(toParam) : new Date();
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }

    // Pipeline de agregação otimizado
    const aggregationPipeline: PipelineStage[] = [];

    // Fase $match inicial para filtrar por data e empreendimento (se aplicável)
    const matchStage: mongoose.FilterQuery<any> = {
        date: { $gte: fromDate, $lte: toDate },
    };
    if (empreendimento && empreendimento !== "todos") {
        if (!mongoose.isValidObjectId(empreendimento)) {
            return NextResponse.json({ error: "ID de empreendimento inválido" }, { status: 400 });
        }
        matchStage.empreendimento = new mongoose.Types.ObjectId(empreendimento);
    }
    aggregationPipeline.push({ $match: matchStage });

    // Fase $group para somar valores por categoria
    aggregationPipeline.push({
        $group: {
            _id: "$category", // Agrupa pela categoria
            value: { $sum: "$value" }, // Soma os valores
        },
    });

    // Fase $project para renomear _id para name e manter value
    aggregationPipeline.push({
        $project: {
            _id: 0, // Exclui o _id original do $group
            name: "$_id", // Renomeia _id para name
            value: 1, // Mantém o valor calculado
        },
    });

     // Fase $sort (opcional, mas bom para consistência)
     aggregationPipeline.push({ $sort: { name: 1 } });

    const categoriesResult = await Despesa.aggregate<CategoryResult>(aggregationPipeline);

    // Garantir que todas as categorias existam na resposta
    const allCategories = ["Material", "Serviço", "Equipamento", "Taxas", "Outros"];
    const result = allCategories.map((categoryName) => {
      const found = categoriesResult.find((cat) => cat.name === categoryName);
      return found || { name: categoryName, value: 0 };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao buscar despesas por categoria:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: "Erro ao buscar dados", details: errorMessage }, { status: 500 });
  }
}