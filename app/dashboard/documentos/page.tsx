import type { Metadata } from "next"
import DocumentosPage from "@/components/documentos/documentos-page"

export const metadata: Metadata = {
  title: "Documentos | Scotta Empreendimentos",
  description: "Gerencie documentos, contratos, certificados e comprovantes",
}

export default function Documentos() {
  return <DocumentosPage />
}

