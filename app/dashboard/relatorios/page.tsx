import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import RelatoriosPageClient from "@/components/relatorios/relatorios-page";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Relatórios | Scotta Empreendimentos",
  description: "Visualize relatórios e análises detalhadas (Acesso Restrito)",
};

export default async function RelatoriosPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const isAdmin = session.user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] p-6 text-center border rounded-lg shadow-sm bg-card text-card-foreground">
        <Lock className="w-12 h-12 mb-4 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Acesso Restrito</h2>
        <p className="max-w-sm text-muted-foreground">
          A visualização dos relatórios está disponível apenas para administradores.
        </p>
      </div>
    );
  }

  return <RelatoriosPageClient />;
}
