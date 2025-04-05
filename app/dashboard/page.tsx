"use client"
import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import DashboardOverview from "@/components/dashboard/dashboard-overview";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { signOut } from "next-auth/react"; // Importado para uso no cliente
import { useEffect, useState } from "react";

// Definindo metadados
export const metadata: Metadata = {
  title: "Dashboard | Gestão Scotta",
  description: "Visão geral dos seus empreendimentos imobiliários",
};

// Componente Cliente para funcionalidades dinâmicas
function DashboardClient({ serverSession }: { serverSession: { user: { email: string; role: string; id: string } } }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("[DashboardClient] Componente montado");
    console.log("[DashboardClient] Sessão inicial do servidor:", serverSession);

    const checkSession = async () => {
      try {
        const session = await getServerSession(authOptions); // Revalida a sessão
        console.log("[DashboardClient] Sessão revalidada:", session);

        if (!session) {
          console.log("[DashboardClient] Nenhuma sessão encontrada, redirecionando para login");
          window.location.href = "/login"; // Redirecionamento completo
          return;
        }

        console.log("[DashboardClient] Sessão válida:", {
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: session.user.role,
        });
        setIsLoading(false);
      } catch (error) {
        console.error("[DashboardClient] Erro ao verificar sessão:", error);
        window.location.href = "/login";
      }
    };

    checkSession();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-4">Carregando dashboard...</p>
      </div>
    );
  }

  // Renderização para Admin
  if (serverSession.user.role === "admin") {
    return <DashboardOverview />;
  }

  // Renderização para Managers e Users
  return (
    <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
      <Lock className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Visão Geral Restrita</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        {serverSession.user.role === "manager"
          ? "O dashboard financeiro completo está disponível apenas para administradores. Utilize o menu para gerenciar empreendimentos e despesas."
          : "Utilize o menu lateral para acessar as funcionalidades disponíveis para você, como o registro de novas despesas."}
      </p>
      <Button variant="default" asChild>
        <Link href="/dashboard/despesas">
          {serverSession.user.role === "manager" ? "Gerenciar Despesas" : "Registrar Nova Despesa"}
        </Link>
      </Button>
      {serverSession.user.role === "manager" && (
        <Button variant="outline" asChild className="mt-4">
          <Link href="/dashboard/empreendimentos">Ver Empreendimentos</Link>
        </Button>
      )}
      <Button
        variant="ghost"
        className="mt-6"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sair
      </Button>
    </div>
  );
}

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
    <DashboardClient
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