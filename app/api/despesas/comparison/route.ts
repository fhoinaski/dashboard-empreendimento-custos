import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa, Empreendimento } from "@/lib/db/models";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const from = new Date(searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1));
    const to = new Date(searchParams.get("to") || new Date());
    const empreendimento = searchParams.get("empreendimento");

       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match: any = {
      date: { $gte: from, $lte: to },
    };
    if (empreendimento && empreendimento !== "todos") {
      match.empreendimento = empreendimento;
    }

    const despesas = await Despesa.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$empreendimento",
          total: { $sum: "$value" },
        },
      },
    ]);

    const empreendimentos = await Empreendimento.find();
    const comparisonData = empreendimentos.map((emp) => {
      const despesa = despesas.find((d) => d._id === emp._id.toString()) || { total: 0 };
      return {
        name: emp.name,
        planejado: emp.totalUnits * emp.soldUnits * 1000, // Exemplo de cálculo fictício
        realizado: despesa.total,
      };
    });

    return NextResponse.json(comparisonData);
  } catch (error) {
    console.error("Erro ao buscar comparativo:", error);
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }
}