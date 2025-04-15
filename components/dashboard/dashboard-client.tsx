// components/dashboard/dashboard-client.tsx
"use client";

import { useSession } from "next-auth/react";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentVentures } from "@/components/dashboard/recent-ventures";
import { useDashboard } from "@/hooks/useDashboard";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import { ArrowUpRight, ArrowDownRight, Wallet, Building2} from "lucide-react";
import { RecentVentureItem } from "@/types/dashboard";



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
  const isManager = session?.user?.role === "manager";
  const isUser = session?.user?.role === "user";
  const {
    dashboardData,
    isLoading,
    recentVentures,
    isRecentVenturesLoading
  } = useDashboard();

  return (
    <>
      {status === "loading" ? (
        <div className="space-y-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>

          {/* Summary Cards Skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-1/2 mt-2" />
                <Skeleton className="h-4 w-full mt-2" />
              </div>
            ))}
          </div>

          {/* Lists Skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="col-span-4 p-4 border rounded-lg">
                <Skeleton className="h-6 w-1/2 mb-2" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex justify-between items-center">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-[80px]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Recent Ventures list Skeleton */}
          <div className="grid gap-4">
            <div className="p-4 border rounded-lg">
              <Skeleton className="h-6 w-1/2 mb-2" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between items-center">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                  <Skeleton className="h-6 w-[80px]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : isAdmin ? (
        // Renderiza o dashboard completo para administradores
        <DashboardOverview />
      ) : (
        // Visão restrita para outros usuários
        <div className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Visão Geral Restrita</h2>
          {isManager && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                   <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2"><Wallet className="h-4 w-4"/>Despesas Aprovadas (Período)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (<Skeleton className="h-8 w-3/4" />) : (
                                <div className="text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.totalApprovedValue ?? 0)}</div>
                            )}
                            {isLoading ? (<Skeleton className="h-4 w-full mt-1" />) : dashboardData?.comparison?.totalApprovedChange !== undefined && dashboardData.comparison.totalApprovedChange !== null && (
                                <p className="text-xs text-muted-foreground flex items-center mt-1">
                                    {dashboardData.comparison.totalApprovedChange === Infinity ? <ArrowUpRight className="mr-1 h-3 w-3 text-green-600" /> : (dashboardData.comparison.totalApprovedChange > 0 ? (<ArrowUpRight className="mr-1 h-3 w-3 text-green-600" />) : dashboardData.comparison.totalApprovedChange < 0 ? (<ArrowDownRight className="mr-1 h-3 w-3 text-red-600" />) : null)}
                                    <span className={dashboardData.comparison.totalApprovedChange > 0 ? "text-green-600" : dashboardData.comparison.totalApprovedChange < 0 ? "text-red-600" : ""}>
                                        {dashboardData.comparison.totalApprovedChange === Infinity ? '+Inf%' : (dashboardData.comparison.totalApprovedChange === -Infinity ? '-Inf%' : (dashboardData.comparison.totalApprovedChange > 0 ? '+' : '') + (dashboardData.comparison.totalApprovedChange === 0 ? '0%' : (dashboardData.comparison.totalApprovedChange * 100).toFixed(0) + '%'))}
                                    </span>
                                    <span className="ml-1">vs. período anterior</span>
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
            {isManager && (<Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4"/>Empreendimentos Recentes</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <RecentVentures data={recentVentures as RecentVentureItem[]} isLoading={isRecentVenturesLoading}/>
                </CardContent>
            </Card>)}
             {(isManager || isUser) && <Card><CardContent className="pl-2"><p className="text-center text-muted-foreground py-4 text-sm">Você não tem permissão para visualizar as despesas.</p></CardContent></Card>}
            <div className="flex gap-4">
                {isManager &&
                <Link href="/dashboard/empreendimentos" legacyBehavior passHref>
                 <Button>Ver Empreendimentos</Button>
                </Link>
                }
                <Link href="/dashboard/despesas" legacyBehavior passHref>
                  <Button>Gerenciar Despesas</Button>
                </Link>
            </div>
        </div>
      )}
    </>
  );
}