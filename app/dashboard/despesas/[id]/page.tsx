import type { Metadata } from "next"
import DespesaDetail from "@/components/despesas/despesa-detail"

export const metadata: Metadata = {
  title: "Detalhes da Despesa | Scotta Empreendimentos",
  description: "Visualize os detalhes da despesa",
}

interface DespesaDetailPageProps {
  params: Promise<{ id: string }>; // Usamos Promise para refletir a natureza assíncrona
}

export default async function DespesaDetailPage({ params }: DespesaDetailPageProps) {
  const resolvedParams = await params; // Resolve a promessa para acessar o id
  

  return <DespesaDetail id={resolvedParams.id} />
}

