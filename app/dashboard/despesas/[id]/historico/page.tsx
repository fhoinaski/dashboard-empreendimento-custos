import type { Metadata } from "next"
import DespesaHistorico from "@/components/despesas/despesa-historico"

export const metadata: Metadata = {
  title: "Histórico da Despesa | Scotta Empreendimentos",
  description: "Visualize o histórico de alterações da despesa",
}

interface DespesaHistoricoPageProps {
  params: Promise<{ id: string }>; // Usamos Promise para refletir a natureza assíncrona
}


export default async function DespesaHistoricoPage({ params }: DespesaHistoricoPageProps) {
  const resolvedParams = await params; // Resolve a promessa para acessar o id
  return <DespesaHistorico id={resolvedParams.id} />
}

