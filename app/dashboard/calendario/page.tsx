import type { Metadata } from "next"
import CalendarioPage from "@/components/calendario/calendario-page"

export const metadata: Metadata = {
  title: "Calendário | Scotta Empreendimentos",
  description: "Visualize o calendário de pagamentos e eventos dos seus empreendimentos",
}

export default function Calendario() {
  return <CalendarioPage />
}

