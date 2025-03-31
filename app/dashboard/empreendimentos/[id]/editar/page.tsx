import type { Metadata } from "next"
import EmpreendimentoEditForm from "@/components/empreendimentos/empreendimento-edit-form"

export const metadata: Metadata = {
  title: "Editar Empreendimento | Scotta Empreendimentos",
  description: "Edite as informações do empreendimento",
}

// Define a interface para os props da página
interface EditarEmpreendimentoPageProps {
  params: Promise<{ id: string }> // Definindo o tipo do parâmetro id
}

export default async function EditarEmpreendimentoPage({ params }: EditarEmpreendimentoPageProps) {
 
  const resolvedParams = await params; // Resolve a promessa para acessar o id


  return <EmpreendimentoEditForm id={resolvedParams.id} />
}

