// FILE: app/api/despesas/categories/route.ts (Refatorado)
import { NextResponse } from "next/server";
import mongoose, { PipelineStage, Types } from "mongoose";
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa } from "@/lib/db/models";
import { getServerSession } from "next-auth/next"; // Importar getServerSession
import { authOptions } from "@/lib/auth/options"; // Importar authOptions

export const revalidate = 600;

interface CategoryResult { name: string; value: number; }
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // --- Verificação de Sessão ---
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !session.user.role) {
            console.warn("[API GET /api/despesas/categories] Acesso não autorizado.");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const userRole = session.user.role;
        const userAssignedEmpreendimentos = (session.user.assignedEmpreendimentos || [])
            .filter(id => mongoose.isValidObjectId(id))
            .map(id => new Types.ObjectId(id));
        // --- Fim Verificação de Sessão ---

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        const empreendimentoParam = searchParams.get("empreendimento");

        const fromDate = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), 0, 1);
        const toDate = toParam ? new Date(toParam) : new Date();
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
        }

        const aggregationPipeline: PipelineStage[] = [];

        // --- Filtro RBAC + Filtros da Requisição ---
        const matchStage: mongoose.FilterQuery<any> = {
            date: { $gte: fromDate, $lte: toDate },
            approvalStatus: 'Aprovado' // Considerar apenas despesas aprovadas para relatórios?
        };

        // Filtro de Empreendimento da URL (se aplicável e permitido)
        let targetEmpreendimentoId: Types.ObjectId | null = null;
        if (empreendimentoParam && empreendimentoParam !== "todos") {
            if (!mongoose.isValidObjectId(empreendimentoParam)) {
                return NextResponse.json({ error: "ID de empreendimento inválido" }, { status: 400 });
            }
            targetEmpreendimentoId = new Types.ObjectId(empreendimentoParam);
        }

        if (userRole === 'admin' || userRole === 'manager') {
            // Admin/Manager: Pode ver o empreendimento específico ou todos
            if (targetEmpreendimentoId) {
                matchStage.empreendimento = targetEmpreendimentoId;
            }
            // Se não houver targetEmpreendimentoId, não filtra por empreendimento (vê todos)
        } else if (userRole === 'user') {
            // User: Pode ver um específico SE atribuído, ou todos os SEUS atribuídos
            if (targetEmpreendimentoId) {
                if (!userAssignedEmpreendimentos.some(id => id.equals(targetEmpreendimentoId!))) {
                    console.warn(`[API GET /api/despesas/categories] Usuário ${session.user.id} tentou acessar empreendimento ${targetEmpreendimentoId} não atribuído.`);
                    return NextResponse.json({ error: 'Acesso negado a este empreendimento' }, { status: 403 });
                }
                matchStage.empreendimento = targetEmpreendimentoId;
            } else {
                // Se não especificou um, filtra por todos os atribuídos
                matchStage.empreendimento = { $in: userAssignedEmpreendimentos };
            }
        } else {
             // Role desconhecida (não deve acontecer, mas por segurança)
            return NextResponse.json({ error: 'Permissão inválida' }, { status: 403 });
        }
        // --- Fim Filtro RBAC ---

        aggregationPipeline.push({ $match: matchStage });
        aggregationPipeline.push({ $group: { _id: "$category", value: { $sum: "$value" } } });
        aggregationPipeline.push({ $project: { _id: 0, name: "$_id", value: 1 } });
        aggregationPipeline.push({ $sort: { name: 1 } });

        const categoriesResult = await Despesa.aggregate<CategoryResult>(aggregationPipeline);

        const allCategories = ["Material", "Serviço", "Equipamento", "Taxas", "Outros"];
        const result = allCategories.map((categoryName) => {
          const found = categoriesResult.find((cat) => cat.name === categoryName);
          return found || { name: categoryName, value: 0 };
        });

        return NextResponse.json(result);
      } catch (error) {
        console.error("[API GET /api/despesas/categories] Erro:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ error: "Erro ao buscar dados por categoria", details: errorMessage }, { status: 500 });
      }
}