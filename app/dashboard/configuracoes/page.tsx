import type { Metadata } from "next"
import ConfiguracoesPage from "@/components/configuracoes/configuracoes-page"

export const metadata: Metadata = {
  title: "Configurações | Scotta Empreendimentos",
  description: "Configure as preferências do sistema",
}

export default function Configuracoes() {
  return <ConfiguracoesPage />
}

