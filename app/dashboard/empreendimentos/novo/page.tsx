import type { Metadata } from "next"
import EmpreendimentoForm from "@/components/empreendimentos/empreendimento-form"

export const metadata: Metadata = {
  title: "Novo Empreendimento | Scotta Empreendimentos",
  description: "Adicione um novo empreendimento imobiliário",
}

export default function NovoEmpreendimentoPage() {
  return <EmpreendimentoForm />
}

