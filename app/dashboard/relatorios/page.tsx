import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import RelatoriosPageClient from "@/components/relatorios/relatorios-page"; // Renomear import
import { Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Relatórios | Scotta Empreendimentos",
  description: "Visualize relatórios e análises (Acesso Restrito)", // Update description
};

export default async function RelatoriosPage() {
   const session = await getServerSession(authOptions);

   if (!session) {
     redirect("/login");
   }

   // --- RBAC CHECK ---
   if (session.user?.role !== 'admin') {
     return (
       <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
         <Lock className="h-12 w-12 text-muted-foreground mb-4" />
         <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
         <p className="text-muted-foreground max-w-sm">
           A visualização de relatórios está disponível apenas para administradores.
         </p>
       </div>
     );
   }
   // --- END RBAC CHECK ---

  // Render the client component only for admins
  return <RelatoriosPageClient />;
}