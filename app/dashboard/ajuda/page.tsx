// Adicionar a página de ajuda que estava faltando
import type { Metadata } from "next"
import AjudaPage from "@/components/ajuda/ajuda-page"

export const metadata: Metadata = {
  title: "Ajuda | Scotta Empreendimentos",
  description: "Central de ajuda e suporte para o sistema",
}

export default function Ajuda() {
  return <AjudaPage />
}

