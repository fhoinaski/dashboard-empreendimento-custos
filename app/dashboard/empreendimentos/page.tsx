import type { Metadata } from "next"
import EmpreendimentosList from "@/components/empreendimentos/empreendimentos-list"

export const metadata: Metadata = {
  title: "Empreendimentos | Scotta Empreendimentos",
  description: "Gerencie seus empreendimentos imobiliários",
}

export default function EmpreendimentosPage() {
  return <EmpreendimentosList />
}
