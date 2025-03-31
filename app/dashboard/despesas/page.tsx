import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import mongoose, { FilterQuery, Types } from "mongoose";
import connectToDatabase from "@/lib/db/mongodb";
import { Despesa } from "@/lib/db/models"; // Importa o Model do Mongoose
import { authOptions } from "@/lib/auth/options";
import DespesasList from "@/components/despesas/despesas-list"; // Client Component
// format e ptBR podem não ser necessários aqui se toda formatação for no client
// import { format } from "date-fns";
// import { ptBR } from "date-fns/locale";

// Metadata
export const metadata: Metadata = {
  title: "Despesas ",
  description: "Gerencie as despesas dos empreendimentos",
};

// Interface para search parameters
interface DespesasPageProps {
  searchParams: Promise<{
    empreendimento?: string;
    status?: string;
    category?: string;
    limit?: string;
    skip?: string;
    despesas: ClientDespesa[];
  }>;
}

// Tipo serializável para o Client Component
// (Idealmente, defina isso em um arquivo compartilhado 'types/index.ts')
interface ClientDespesa {
  _id: string;
  description: string;
  value: number;
  date: string; // ISO string
  dueDate: string; // ISO string
  status: string;
  empreendimento: {
    _id: string;
    name: string;
  };
  category: string;
  paymentMethod?: string;
  createdBy: string;
  attachments?: {
    fileId: string;
    name: string;
    url: string;
  }[];
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}



// Server Component
export default async function DespesasPage({ searchParams }: DespesasPageProps) {
  const resolvedSearchParams = await searchParams;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Despesas</h1>
          <p className="text-red-500">Não autorizado. Faça login para visualizar as despesas.</p>
        </div>
      );
    }

    await connectToDatabase();

    const {
      empreendimento: empreendimentoId,
      status: statusParam,
      category: categoryParam,
      limit: limitParam,
      skip: skipParam,
    } = resolvedSearchParams;

    // Validação
    if (empreendimentoId && !mongoose.isValidObjectId(empreendimentoId)) {
      throw new Error("ID de empreendimento inválido.");
    }
    const validStatus = ["Pago", "Pendente", "A vencer"];
    if (statusParam && !validStatus.includes(statusParam)) {
      throw new Error(`Status inválido. Valores permitidos: ${validStatus.join(", ")}.`);
    }
    const validCategories = ["Material", "Serviço", "Equipamento", "Taxas", "Outros"];
    if (categoryParam && !validCategories.includes(categoryParam)) {
      throw new Error(`Categoria inválida. Valores permitidos: ${validCategories.join(", ")}.`);
    }
    const limit = limitParam && !isNaN(parseInt(limitParam)) ? parseInt(limitParam) : 100;
    const skip = skipParam && !isNaN(parseInt(skipParam)) ? parseInt(skipParam) : 0;
    if (limit < 1) throw new Error("Limite deve ser maior que 0.");
    if (skip < 0) throw new Error("Deslocamento não pode ser negativo.");

    // Filtro Mongoose
    const filter: FilterQuery<typeof Despesa> = {};
    if (empreendimentoId) {
      filter.empreendimento = new mongoose.Types.ObjectId(empreendimentoId);
    }
    if (statusParam) {
      filter.status = statusParam;
    }
    if (categoryParam) {
      filter.category = categoryParam;
    }
    // filter.createdBy = new mongoose.Types.ObjectId(session.user.id); // Se necessário

    // Fetch Data
    const despesasRaw = await Despesa.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>("empreendimento", "name _id")
      .lean<any[]>(); // Usar any[] é aceitável com .lean() se não tiver um tipo Lean específico

    // Transformar para tipo serializável (ClientDespesa)
    const despesasMapped = despesasRaw.map((despesa): ClientDespesa | null => {
      if (!despesa?._id || !despesa.empreendimento?._id || !despesa.createdBy) {
        console.warn("Skipping despesa due to missing essential data:", despesa?._id);
        return null;
      }
      return {
        _id: despesa._id.toString(),
        description: despesa.description,
        value: despesa.value,
        date: new Date(despesa.date).toISOString(),
        dueDate: new Date(despesa.dueDate).toISOString(),
        status: despesa.status,
        empreendimento: {
          _id: despesa.empreendimento._id.toString(),
          name: despesa.empreendimento.name,
        },
        category: despesa.category,
        paymentMethod: despesa.paymentMethod ?? undefined,
        createdBy: despesa.createdBy.toString(),
        attachments: despesa.attachments?.filter((att: any) => att.fileId && att.name && att.url).map((att: any) => ({
            fileId: att.fileId,
            name: att.name,
            url: att.url,
        })) ?? [],
        createdAt: new Date(despesa.createdAt).toISOString(),
        updatedAt: new Date(despesa.updatedAt).toISOString(),
      };
    });

    // Filtrar nulos e garantir tipo
    const despesas: ClientDespesa[] = despesasMapped.filter(
        (d): d is ClientDespesa => d !== null
    );

    const total = await Despesa.countDocuments(filter);

    // Renderizar Client Component
    return (
      <div className="p-2 sm:p-4 md:p-6 lg:p-8">
    <DespesasList /> 
  </div>
    );

  } catch (error) {
    console.error("Erro ao carregar a página de despesas:", error);
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Despesas</h1>
        <p className="text-red-500">
          Ocorreu um erro ao carregar as despesas. Detalhes: {error instanceof Error ? error.message : "Erro desconhecido."}
        </p>
      </div>
    );
  }
}