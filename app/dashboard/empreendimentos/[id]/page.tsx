/* ================================== */
/* app/dashboard/empreendimentos/[id]/page.tsx (RBAC Applied) */
/* ================================== */
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import EmpreendimentoDetail from "@/components/empreendimentos/empreendimento-detail";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Detalhes do Empreendimento | Gestão Scotta",
  description: "Visualize os detalhes do empreendimento",
};

interface EmpreendimentoDetailPageProps {
  params: Promise<{ id: string }>; // Params é uma Promise no Next.js 15
}

export default async function EmpreendimentoDetailPage({ params }: EmpreendimentoDetailPageProps) {
  const { id } = await params; // Extraindo o id da Promise
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // --- RBAC CHECK: Allow ONLY Admin and Manager ---
  if (!['admin', 'manager'].includes(session.user?.role ?? '')) {
    return (
      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground max-w-sm">
          A visualização dos detalhes do empreendimento está disponível apenas para Administradores e Gerentes.
        </p>
      </div>
    );
  }
  // --- END RBAC CHECK ---

  // If authorized, render the detail component
  return <EmpreendimentoDetail id={id} />;
}