/* ================================== */
/*        app/dashboard/page.tsx        */
/* ================================== */
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import { Lock } from "lucide-react"; // Import Lock icon
import { Button } from "@/components/ui/button"; // Import Button
import Link from "next/link"; // Import Link

export const metadata: Metadata = {
  title: "Dashboard | Gestão Scotta", // Updated Title
  description: "Visão geral dos seus empreendimentos imobiliários",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session) {
    redirect("/login");
  }

  // Render DashboardOverview ONLY for admins
  if (session.user?.role === 'admin') {
    return <DashboardOverview />;
  }

  // Show a restricted view for Managers and Users
  return (
     <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Visão Geral Restrita</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
           {session.user?.role === 'manager'
              ? "O dashboard financeiro completo está disponível apenas para administradores. Utilize o menu para gerenciar empreendimentos e despesas."
              : "Utilize o menu lateral para acessar as funcionalidades disponíveis para você, como o registro de novas despesas."
            }
        </p>
         <Button variant="default" asChild>
              <Link href="/dashboard/despesas">
                  {session.user?.role === 'manager' ? "Gerenciar Despesas" : "Registrar Nova Despesa"}
             </Link>
         </Button>
         {session.user?.role === 'manager' && (
              <Button variant="outline" asChild className="mt-4">
                  <Link href="/dashboard/empreendimentos">Ver Empreendimentos</Link>
             </Button>
         )}
     </div>
  );
}