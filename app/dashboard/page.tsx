import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import DashboardClientComponent from "@/components/dashboard/dashboard-client";


// Definindo metadados (apenas no componente servidor)
export const metadata: Metadata = {
  title: "Dashboard | Gestão Scotta",
  description: "Visão geral dos seus empreendimentos imobiliários",
};

// Componente Principal (Server Component)
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  console.log("[DashboardPage] Verificando sessão no servidor:", session ? "Encontrada" : "Não encontrada");

  // Redirect if not authenticated
  if (!session) {
    console.log("[DashboardPage] Sem sessão, redirecionando para login");
    redirect("/login");
  }

  console.log("[DashboardPage] Sessão válida, carregando dashboard");

  // Passa a sessão para o componente cliente
  return (
    <DashboardClientComponent
      serverSession={{
        user: {
          email: session.user.email ?? "",
          role: session.user.role ?? "user",
          id: session.user.id ?? "",
        },
      }}
    />
  );
}