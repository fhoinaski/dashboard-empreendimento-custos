// components/dashboard/dashboard-overview.tsx (CORRECTED)
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercent, formatDate } from '@/utils/format';
import { useDashboard } from '@/hooks/useDashboard';
import { PieChart } from '@/components/relatorios/pie-chart';
import { BarChart } from '@/components/relatorios/bar-chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { RecentVentures } from '@/components/dashboard/recent-ventures'; // Keep named import

// --- TYPE DEFINITIONS ---
// (Keep existing type definitions)
interface MonthlyDataPoint { month: string; value: number; }
interface CategoryData { [category: string]: number; }
interface PendingApprovalItem { id: string; description: string; empreendimentoName: string; value: number; }
interface UpcomingExpenseItem { id: string; description: string; dueDate: string; value: number; }
interface PieChartDataPoint { name: string; value: number; color: string; }
interface BarChartDataPoint { name: string; value: number; color?: string; }
interface RecentVentureItem { id: string; name: string; status: string; pendingExpenses?: number; updatedAt: string; image?: string; }
// --- END TYPE DEFINITIONS ---

export function DashboardOverview() {
  const {
    dashboardData,
    pendingApprovals,
    upcomingExpenses,
    // *** UNCOMMENT AND USE FROM HOOK ***
    recentVentures,
    isRecentVenturesLoading,
    // *** END UNCOMMENT ***
    expenseChartData,
    revenueChartData,
    isLoading, // Overall loading might combine sub-loadings
    isPendingApprovalsLoading,
    isUpcomingExpensesLoading,
    isExpenseChartLoading,
    isRevenueChartLoading,
    refreshDashboard
  } = useDashboard();

  // Remove local recentVentures definition
  // const recentVentures: RecentVentureItem[] = [];
  // const isRecentVenturesLoading = isLoading;

  // --- useMemo hooks for chart data (Keep as is) ---
  const pieChartData: PieChartDataPoint[] = React.useMemo(() => { /* ... */
    if (!expenseChartData?.byCategory || typeof expenseChartData.byCategory !== 'object') { return []; }
    const colors: Record<string, string> = { 'Material': '#3b82f6', 'Serviço': '#10b981', 'Equipamento': '#f59e0b', 'Taxas': '#ef4444', 'Outros': '#8b5cf6', };
    return Object.entries(expenseChartData.byCategory)
      .map(([category, value]): PieChartDataPoint | null => { if (typeof value === 'number' && !isNaN(value)) { return { name: category, value: value, color: colors[category] || '#6b7280' }; } return null; })
      .filter((item): item is PieChartDataPoint => item !== null);
   }, [expenseChartData]);
  const expenseBarChartData: BarChartDataPoint[] = React.useMemo(() => { /* ... */
     if (!expenseChartData?.byMonth || !Array.isArray(expenseChartData.byMonth)) { return []; }
     return expenseChartData.byMonth.map((item: MonthlyDataPoint) => ({ name: item.month, value: typeof item.value === 'number' ? item.value : 0, color: '#3b82f6' }));
    }, [expenseChartData]);
  const revenueBarChartData: BarChartDataPoint[] = React.useMemo(() => { /* ... */
     if (!revenueChartData?.byMonth || !Array.isArray(revenueChartData.byMonth)) { return []; }
     return revenueChartData.byMonth.map((item: MonthlyDataPoint) => ({ name: item.month, value: typeof item.value === 'number' ? item.value : 0, color: '#10b981' }));
    }, [revenueChartData]);

  // Determine overall loading state (consider if needed)
   const isAnyLoading = isLoading || isPendingApprovalsLoading || isUpcomingExpensesLoading || isRecentVenturesLoading || isExpenseChartLoading || isRevenueChartLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={isAnyLoading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total de Despesas Aprovadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Aprovadas (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            {isAnyLoading ? (<Skeleton className="h-8 w-3/4" />) : ( // Use combined loading state
              <div className="text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.totalApprovedValue ?? 0)}</div>
            )}
            {isAnyLoading ? (<Skeleton className="h-4 w-full mt-1" />) : dashboardData?.comparison?.totalApprovedChange !== undefined && dashboardData.comparison.totalApprovedChange !== null && (
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {dashboardData.comparison.totalApprovedChange === Infinity ? <ArrowUpRight className="mr-1 h-3 w-3 text-green-600" /> : (dashboardData.comparison.totalApprovedChange > 0 ? (<ArrowUpRight className="mr-1 h-3 w-3 text-green-600" />) : dashboardData.comparison.totalApprovedChange < 0 ? (<ArrowDownRight className="mr-1 h-3 w-3 text-red-600" />) : null)}
                 <span className={dashboardData.comparison.totalApprovedChange > 0 ? "text-green-600" : dashboardData.comparison.totalApprovedChange < 0 ? "text-red-600" : ""}>
                    {dashboardData.comparison.totalApprovedChange === Infinity ? '+Inf%' : (dashboardData.comparison.totalApprovedChange === -Infinity ? '-Inf%' : formatPercent(dashboardData.comparison.totalApprovedChange / 100))}
                </span>
                <span className="ml-1">vs. período anterior</span>
              </p>
            )}
          </CardContent>
        </Card>

         {/* Despesas a Vencer */}
         <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">A Vencer (Período)</CardTitle> </CardHeader>
             <CardContent>
                 {isAnyLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.dueValue ?? 0)}</div>}
                 {isAnyLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : <p className="text-xs text-muted-foreground mt-1">{dashboardData?.currentPeriod?.dueCount ?? 0} despesa(s)</p>}
             </CardContent>
         </Card>
         {/* Despesas Pagas */}
         <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Pagas (Período)</CardTitle> </CardHeader>
             <CardContent>
                 {isAnyLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.paidValue ?? 0)}</div>}
                 {isAnyLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : <p className="text-xs text-muted-foreground mt-1">{dashboardData?.currentPeriod?.paidCount ?? 0} despesa(s)</p>}
             </CardContent>
         </Card>
         {/* Total Empreendimentos */}
         <Card>
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> <CardTitle className="text-sm font-medium">Total Empreendimentos</CardTitle> </CardHeader>
             <CardContent>
                 {isAnyLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{dashboardData?.totalEmpreendimentos ?? 0}</div>}
                 {isAnyLoading ? <Skeleton className="h-4 w-2/3 mt-1" /> : <p className="text-xs text-muted-foreground mt-1">Empreendimentos no sistema</p>}
             </CardContent>
         </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
          <CardContent className="h-[300px] p-0"> {/* Adjusted padding for chart */}
            <PieChart data={pieChartData} isLoading={isExpenseChartLoading} /> {/* Pass isLoading */}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader><CardTitle>Despesas por Mês</CardTitle></CardHeader>
           <CardContent className="h-[300px] p-0 pl-2"> {/* Adjusted padding for chart */}
            <BarChart data={expenseBarChartData} isLoading={isExpenseChartLoading} formatValue={formatCurrency} /> {/* Pass isLoading */}
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Pendentes de Aprovação</CardTitle></CardHeader>
          <CardContent>
            {isPendingApprovalsLoading ? ( /* ... Skeleton ... */ <div className="space-y-4">{[1, 2, 3].map((i) => (<div key={`skel-pend-${i}`} className="flex justify-between items-center"><div className="space-y-1"><Skeleton className="h-4 w-[200px]" /><Skeleton className="h-3 w-[150px]" /></div><Skeleton className="h-6 w-[80px]" /></div>))}</div> ) : pendingApprovals.length > 0 ? ( <div className="space-y-4">{pendingApprovals.map((despesa: PendingApprovalItem) => (<div key={despesa.id} className="flex justify-between items-center"><div className="space-y-1"><p className="font-medium text-sm">{despesa.description}</p><p className="text-xs text-muted-foreground">{despesa.empreendimentoName}</p></div><Badge variant="secondary">{formatCurrency(despesa.value)}</Badge></div>))}</div> ) : (<p className="text-center text-muted-foreground py-4 text-sm">Não há despesas pendentes.</p>)}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader><CardTitle>Próximos Vencimentos</CardTitle></CardHeader>
          <CardContent>
            {isUpcomingExpensesLoading ? ( /* ... Skeleton ... */ <div className="space-y-4">{[1, 2, 3].map((i) => (<div key={`skel-upc-${i}`} className="flex justify-between items-center"><div className="space-y-1"><Skeleton className="h-4 w-[150px]" /><Skeleton className="h-3 w-[100px]" /></div><Skeleton className="h-6 w-[80px]" /></div>))}</div> ) : upcomingExpenses.length > 0 ? ( <div className="space-y-4">{upcomingExpenses.map((despesa: UpcomingExpenseItem) => (<div key={despesa.id} className="flex justify-between items-center"><div className="space-y-1"><p className="font-medium text-sm">{despesa.description}</p><p className="text-xs text-muted-foreground">Vence em: {formatDate(despesa.dueDate)}</p></div><Badge variant="outline">{formatCurrency(despesa.value)}</Badge></div>))}</div> ) : (<p className="text-center text-muted-foreground py-4 text-sm">Nenhuma despesa a vencer.</p>)}
          </CardContent>
        </Card>
      </div>

      {/* Recent Ventures list */}
      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle>Empreendimentos Recentes</CardTitle></CardHeader>
          <CardContent>
            {/* *** Pass data and isLoading from hook *** */}
            <RecentVentures
                data={recentVentures as RecentVentureItem[]} // Use data from hook
                isLoading={isRecentVenturesLoading}          // Use loading state from hook
            />
             {/* *** END PROP PASSING *** */}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}