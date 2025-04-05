/* ================================== */
/* app/dashboard/empreendimentos/[id]/editar/page.tsx (RBAC Applied) */
/* ================================== */
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import EmpreendimentoEditForm from "@/components/empreendimentos/empreendimento-edit-form";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Editar Empreendimento | Gestão Scotta",
  description: "Edite as informações do empreendimento",
};

interface EditarEmpreendimentoPageProps {
  params: Promise<{ id: string }>; // Atualizado para Promise conforme Next.js 15
}

export default async function EditarEmpreendimentoPage({ params }: EditarEmpreendimentoPageProps) {
  const { id } = await params; // Aguardando a resolução da Promise
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // --- RBAC CHECK: Allow ONLY Admin ---
  if (session.user?.role !== 'admin') {
    return (
      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-sm">
          A edição de empreendimentos está disponível apenas para Administradores.
        </p>
      </div>
    );
  }
  // --- END RBAC CHECK ---

  // If authorized, render the edit form component
  return <EmpreendimentoEditForm id={id} />;
}