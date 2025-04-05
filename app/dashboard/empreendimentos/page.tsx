import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import EmpreendimentosList from "@/components/empreendimentos/empreendimentos-list";
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Empreendimentos | Gestão Scotta", // Updated Title
  description: "Gerencie seus empreendimentos imobiliários (Acesso Restrito)",
};

export default async function EmpreendimentosPage() {
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
           A visualização e gestão de empreendimentos está disponível apenas para Administradores e Gerentes.
         </p>
       </div>
     );
   }
   // --- END RBAC CHECK ---

  // Render the list component for authorized roles
  return <EmpreendimentosList />;
}