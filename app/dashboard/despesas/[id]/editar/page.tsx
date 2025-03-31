import type { Metadata } from "next";
import DespesaEditForm from "@/components/despesas/despesa-edit-form";

// Define os metadados da página
export const metadata: Metadata = {
  title: "Editar Despesa | Scotta Empreendimentos",
  description: "Edite as informações da despesa",
};

// Define a interface para os props da página, compatível com Next.js App Router
interface EditarDespesaPageProps {
  params: Promise<{ id: string }>; // Usamos Promise para refletir a natureza assíncrona
}

// Componente da página como async para lidar com params assíncronos
export default async function EditarDespesaPage({ params }: EditarDespesaPageProps) {
  const resolvedParams = await params; // Resolve a promessa para acessar o id
  return <DespesaEditForm id={resolvedParams.id} />;
}