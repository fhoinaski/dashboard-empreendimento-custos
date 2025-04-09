// hooks/useDashboard.ts
import { trpc } from '@/lib/trpc/client';
import { useCallback, useMemo } from 'react'; // Added useMemo just in case, although not strictly needed here now
import { useToast } from '@/components/ui/use-toast';

// *** THIS IS THE LINE TO FIX ***
// Change this import:
// import type { RecentVentureItem } from '@/components/dashboard/dashboard-overview';
// To this:
import type { RecentVentureItem } from '@/types/dashboard'; // Adjust path if your shared file is elsewhere (e.g., '@/types/index')

// Import the specific response type from tRPC types
import type { ClientEmpreendimento } from '@/lib/trpc/types';


export function useDashboard() {
  const { toast } = useToast();
  const utils = trpc.useContext();

  // Query principal
  const dashboardQuery = trpc.dashboard.getStats.useQuery(undefined, { staleTime: 1000 * 60 * 5, });

  // Queries de gráficos
  const expenseChartDataQuery = trpc.dashboard.getExpenseChartData.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const revenueChartDataQuery = trpc.dashboard.getRevenueChartData.useQuery(undefined, { staleTime: 1000 * 60 * 5 });

  // Queries de listas
  const pendingApprovalsQuery = trpc.despesas.listPendingReview.useQuery({ limit: 5 }, { staleTime: 1000 * 60 * 5 });
  const upcomingExpensesQuery = trpc.despesas.listUpcomingDue.useQuery({ limit: 5 }, { staleTime: 1000 * 60 * 5 });

  // Query for Recent Ventures
  const recentVenturesQuery = trpc.empreendimentos.getAll.useQuery(
      { limit: 4, sortBy: 'updatedAt', sortOrder: 'desc', page: 1 },
      { staleTime: 1000 * 60 * 10 }
  );

  // Função de refresh
  const refreshDashboard = useCallback(() => {
    console.log("[useDashboard] Invalidando queries...");
    try {
      utils.dashboard.getStats.invalidate();
      utils.dashboard.getExpenseChartData.invalidate();
      utils.dashboard.getRevenueChartData.invalidate();
      utils.despesas.listPendingReview.invalidate();
      utils.despesas.listUpcomingDue.invalidate();
      utils.empreendimentos.getAll.invalidate(); // Invalidate the list used for recent ventures
      utils.notifications.getSummary.invalidate();
      toast({ title: "Dashboard atualizado", description: "Os dados foram atualizados." });
      console.log("[useDashboard] Invalidação concluída.");
    } catch (error) {
      console.error("[useDashboard] Erro ao invalidar queries:", error);
      toast({ title: "Erro ao atualizar", description: "Ocorreu um erro.", variant: "destructive",});
    }
  }, [utils, toast]);


  // Process recent ventures data using useMemo for potential optimization
  const processedRecentVentures: RecentVentureItem[] = useMemo(() => {
      return (recentVenturesQuery.data?.empreendimentos || [])
         .map((emp: ClientEmpreendimento): RecentVentureItem => ({ // Ensure mapping is correct
            id: emp._id,
            name: emp.name,
            status: emp.status,
            pendingExpenses: emp.pendingExpenses,
            updatedAt: emp.updatedAt,
            image: emp.image, // This should be string | null based on ClientEmpreendimento
        }));
  }, [recentVenturesQuery.data?.empreendimentos]);


  return {
    // Dados
    dashboardData: dashboardQuery.data,
    pendingApprovals: pendingApprovalsQuery.data?.items || [],
    upcomingExpenses: upcomingExpensesQuery.data?.items || [],
    recentVentures: processedRecentVentures, // Return typed data
    expenseChartData: expenseChartDataQuery.data,
    revenueChartData: revenueChartDataQuery.data,

    // Loading States
    isLoading: // Combined loading state needs to include recentVenturesQuery
      dashboardQuery.isLoading ||
      expenseChartDataQuery.isLoading ||
      revenueChartDataQuery.isLoading ||
      pendingApprovalsQuery.isLoading ||
      upcomingExpensesQuery.isLoading ||
      recentVenturesQuery.isLoading, // Add recent ventures loading

    isDashboardLoading: dashboardQuery.isLoading,
    isPendingApprovalsLoading: pendingApprovalsQuery.isLoading,
    isUpcomingExpensesLoading: upcomingExpensesQuery.isLoading,
    isRecentVenturesLoading: recentVenturesQuery.isLoading || recentVenturesQuery.isFetching,
    isExpenseChartLoading: expenseChartDataQuery.isLoading,
    isRevenueChartLoading: revenueChartDataQuery.isLoading,

    // Funções
    refreshDashboard,
  };
}