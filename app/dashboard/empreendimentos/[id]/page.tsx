import type { Metadata } from "next"
import EmpreendimentoDetail from "@/components/empreendimentos/empreendimento-detail"

export const metadata: Metadata = {
  title: "Detalhes do Empreendimento | Scotta Empreendimentos",
  description: "Visualize os detalhes do empreendimento",
}

// Define a interface para os parâmetros da página
interface EmpreendimentoDetailPageProps {
  params: Promise<{ id: string }>
}


export default async function EmpreendimentoDetailPage({ params }: EmpreendimentoDetailPageProps) {
  // Aqui, params.id é o ID do empreendimento que você deseja exibir

  const resolvedParams = await params; // Resolve a promessa para acessar o id

  return <EmpreendimentoDetail id={resolvedParams.id} />
}

