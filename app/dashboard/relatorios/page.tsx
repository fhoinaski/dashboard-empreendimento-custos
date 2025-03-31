import type { Metadata } from "next"
import RelatoriosPage from "@/components/relatorios/relatorios-page"

export const metadata: Metadata = {
  title: "Relatórios | Scotta Empreendimentos",
  description: "Visualize relatórios e análises dos seus empreendimentos imobiliários",
}

export default function Relatorios() {
  return <RelatoriosPage />
}

