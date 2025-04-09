// components/dashboard/dashboard-client.tsx
"use client";

import { useSession } from "next-auth/react";
import {DashboardOverview} from "@/components/dashboard/dashboard-overview";
import { Skeleton } from "@/components/ui/skeleton";

// Interface para as props recebidas do servidor
interface ServerSessionProps {
  user: {
    email: string;
    role: string;
    id: string;
  };
}

interface DashboardClientComponentProps {
  serverSession: ServerSessionProps;
}

export default function DashboardClientComponent({ serverSession }: DashboardClientComponentProps) {
  // Inicializa a sessão do cliente com os dados do servidor
  const { data: clientSession, status } = useSession();
  
  // Usa a sessão do servidor enquanto a sessão do cliente está carregando
  const session = status === "loading" ? { user: serverSession.user } : clientSession;
  
  // Verifica se o usuário tem permissão para acessar o dashboard completo
  const isAdmin = session?.user?.role === "admin";

  return (
    <>
          {status === "loading" ? (
            // Skeleton enquanto carrega
            <div className="space-y-4 sm:space-y-6 animate-pulse">
              <Skeleton className="h-8 w-64 rounded-md" />
              <Skeleton className="h-64 w-full rounded-md" />
              <Skeleton className="h-64 w-full rounded-md" />
            </div>
          ) : isAdmin ? (
            // Renderiza o dashboard completo para administradores
            <DashboardOverview />
          ) : (
            // Visão restrita para outros usuários
            <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
              <div className="h-12 w-12 text-muted-foreground mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Visão Geral Restrita</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                {session?.user?.role === "manager" 
                  ? "Como gerente, você tem acesso limitado ao dashboard. Por favor, navegue para Empreendimentos ou Despesas para gerenciar seus recursos."
                  : "Como usuário, você tem acesso limitado ao dashboard. Por favor, navegue para Despesas para visualizar e gerenciar suas despesas."}
              </p>
              <div className="flex gap-4">
                <a href="/dashboard/empreendimentos" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                  Ver Empreendimentos
                </a>
                <a href="/dashboard/despesas" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/90 h-10 px-4 py-2">
                  Gerenciar Despesas
                </a>
              </div>
            </div>
          )}
    </>
  );
}