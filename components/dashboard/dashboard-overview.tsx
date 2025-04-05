// FILE: components/dashboard/dashboard-overview.tsx
// STATUS: COMPLETE AND CORRECTED

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Building, Receipt, AlertTriangle, CheckCircle, ArrowRight, Calendar as CalendarIcon,
    TrendingUp, TrendingDown, Minus, DollarSign, Loader2, Plus, Lock, Clock, ListChecks
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { RecentVentures } from "./recent-ventures"; // Assuming this component exists and is correct
import { ExpenseChart } from "./expense-chart"; // Assuming this component exists and is correct
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSession } from "next-auth/react";

// --- Skeleton Component Definition ---
const DashboardOverviewSkeleton = () => (
     <div className="space-y-4 sm:space-y-6 animate-pulse">
       {/* Header Skeleton */}
       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3 sm:pb-4">
         <div className="space-y-1.5">
             <Skeleton className="h-6 w-40 rounded-md" />
             <Skeleton className="h-4 w-64 rounded-md" />
         </div>
         {/* Filter Skeletons */}
         <div className="flex flex-col sm:flex-row gap-2">
             <Skeleton className="h-10 w-full sm:w-48 md:w-60 rounded-md" /> {/* Empreendimento Select */}
             <Skeleton className="h-10 w-full sm:w-60 rounded-md" /> {/* Date Picker */}
             <Skeleton className="h-10 w-full sm:w-auto rounded-md px-4" /> {/* New Expense Button */}
         </div>
       </div>
       {/* Stat Cards Skeleton */}
       <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
         {Array.from({ length: 5 }).map((_, i) => (
           <Card key={`stat-skel-${i}`} className="p-3 sm:p-4">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                   <Skeleton className="h-4 w-20 rounded-md" />
                   <Skeleton className="h-5 w-5 rounded-full" />
               </CardHeader>
               <CardContent className="p-0">
                   <Skeleton className="h-7 w-24 mb-1 rounded-md" />
                   <Skeleton className="h-3 w-full rounded-md" />
               </CardContent>
           </Card>
         ))}
       </div>
       {/* Chart and Recent Ventures Skeleton */}
       <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
         <Card className="col-span-1 lg:col-span-4">
             <CardHeader className="pb-2">
                 <Skeleton className="h-5 w-32 rounded-md" />
                 <Skeleton className="h-4 w-48 rounded-md" />
             </CardHeader>
             <CardContent className="pl-2 pr-4 sm:pr-6">
                 <Skeleton className="h-[300px] w-full rounded-md" />
             </CardContent>
         </Card>
         <Card className="col-span-1 lg:col-span-3 flex flex-col">
             <CardHeader className="pb-2">
                 <Skeleton className="h-5 w-40 rounded-md" />
                 <Skeleton className="h-4 w-56 rounded-md" />
             </CardHeader>
             <CardContent className="flex-grow p-3 space-y-3">
                 {/* Skeleton items for recent ventures list */}
                 <div className="flex gap-3 items-center"> <Skeleton className="h-10 w-10 rounded-md"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4"/><Skeleton className="h-3 w-1/2"/></div><Skeleton className="h-4 w-16"/></div>
                 <div className="flex gap-3 items-center"> <Skeleton className="h-10 w-10 rounded-md"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-4/5"/><Skeleton className="h-3 w-1/3"/></div><Skeleton className="h-4 w-14"/></div>
                 <div className="flex gap-3 items-center"> <Skeleton className="h-10 w-10 rounded-md"/><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-2/3"/><Skeleton className="h-3 w-1/2"/></div><Skeleton className="h-4 w-12"/></div>
             </CardContent>
             <CardFooter className="p-3 border-t">
                 <Skeleton className="h-9 w-full rounded-md" />
             </CardFooter>
         </Card>
       </div>
     </div>
);

// --- Interfaces ---
interface DashboardData {
    totalEmpreendimentos: number;
    currentPeriod: {
        totalApprovedValue: number; totalApprovedCount: number;
        dueValue: number; dueCount: number;
        paidValue: number; paidCount: number;
        totalAllValue: number; totalAllCount: number;
    };
    previousPeriod?: {
        totalApprovedValue: number; dueValue: number; paidValue: number;
        totalAllValue: number;
    };
    comparison?: {
        totalApprovedChange: number | null;
        dueChange: number | null;
        paidChange: number | null;
    };
    pendingApproval?: { count: number; value: number };
    upcomingExpenses?: { count: number; value: number; };
}
interface EmpreendimentoOption { _id: string; name: string; }

// --- Main Component ---
export default function DashboardOverview() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);

  // States
  const [date, setDate] = useState<DateRange | undefined>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()), });
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("todos");
  const [empreendimentosList, setEmpreendimentosList] = useState<EmpreendimentoOption[]>([]);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true); // Specific loading for the dropdown list
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true); // General loading for dashboard cards/charts
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // --- Fetch Empreendimentos (for Filter Dropdown) ---
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      console.log("[DashboardOverview fetchEmpreendimentos] Running fetch...");
      if (!isAdmin || sessionStatus !== 'authenticated') {
        setIsFetchingFilters(false);
        setEmpreendimentosList([]);
        console.log("[DashboardOverview fetchEmpreendimentos] Skipping: Not admin or not authenticated.");
        return;
      }
      setIsFetchingFilters(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999"); // Fetch all for filter
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos para filtro");
        const data = await response.json();
        if (isMounted && data?.empreendimentos) {
          setEmpreendimentosList(data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name })));
          console.log("[DashboardOverview fetchEmpreendimentos] Success, count:", data.empreendimentos.length);
        } else if (isMounted) {
          setEmpreendimentosList([]);
        }
      } catch (error) {
        if (isMounted) {
          console.error("[DashboardOverview fetchEmpreendimentos] Error:", error);
          toast({ variant: "destructive", title: "Erro Filtro", description: "Não foi possível carregar empreendimentos." });
          setEmpreendimentosList([]);
        }
      } finally {
        if (isMounted) setIsFetchingFilters(false);
      }
    }
    console.log("[DashboardOverview fetchEmpreendimentos] useEffect triggered. isAdmin:", isAdmin, "Status:", sessionStatus);
    fetchEmpreendimentos();
    return () => { isMounted = false };
  // Corrected dependencies: Only fetch when auth status or admin status changes.
  }, [isAdmin, sessionStatus, toast]);

  // --- Fetch Dashboard Data ---
  useEffect(() => {
    let isMounted = true;
    async function fetchDashboardData() {
      console.log("[DashboardOverview fetchDashboardData] Running fetch...");
      if (!isAdmin || sessionStatus !== 'authenticated') {
        setIsLoading(false);
        setDashboardData(null);
        console.log("[DashboardOverview fetchDashboardData] Skipping: Not admin or not authenticated.");
        return;
      }

      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (date?.from) params.set("from", date.from.toISOString());
      if (date?.to) params.set("to", endOfDay(date.to).toISOString());
      if (selectedEmpreendimentoId !== 'todos') params.set("empreendimentoId", selectedEmpreendimentoId);

      try {
        const response = await fetch(`/api/dashboard?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ details: "Erro desconhecido." }));
          if (response.status === 403) throw new Error("Acesso negado.");
          throw new Error(errorData.details || `Erro ${response.status}`);
        }
        const data: DashboardData = await response.json();
        if (isMounted) {
          setDashboardData(data);
          console.log("[DashboardOverview fetchDashboardData] Success.");
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Falha ao carregar dados.";
          console.error("[DashboardOverview fetchDashboardData] Error:", err);
          setError(errorMessage);
          setDashboardData(null);
          toast({ variant: "destructive", title: "Erro Dashboard", description: errorMessage });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    console.log("[DashboardOverview fetchDashboardData] useEffect triggered. Date:", date, "SelectedEmp:", selectedEmpreendimentoId, "isAdmin:", isAdmin, "Status:", sessionStatus);
    fetchDashboardData();
    return () => { isMounted = false };
  // Correct dependencies: Fetch when date, selection, or auth status changes.
  }, [date, selectedEmpreendimentoId, isAdmin, sessionStatus, toast]);

  // --- Formatting and Comparison Helpers ---
  const formatCurrency = (value: number | undefined | null): string =>
    value?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0,00";

  const renderComparison = (change: number | null | undefined): React.ReactNode => {
    if (change === null || change === undefined || isNaN(change)) {
      return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-0.5" /> --</span>;
    }
    const isPositive = change > 0; // Positive change (increase in cost) is bad -> red
    const isNegative = change < 0; // Negative change (decrease in cost) is good -> green
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    const color = isPositive ? "text-destructive" : isNegative ? "text-green-600" : "text-muted-foreground";
    return (
      <span className={cn("text-xs flex items-center", color)}>
        <Icon className="h-3 w-3 mr-0.5" />
        {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  // Specific comparison rendering for pending expenses (increase is bad)
  const renderPendentComparison = (change: number | null | undefined): React.ReactNode => {
    if (change === null || change === undefined || isNaN(change)) {
        return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-0.5" /> --</span>;
    }
    const isPositive = change > 0; // More pending is bad -> red
    const isNegative = change < 0; // Less pending is good -> green
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
    const color = isPositive ? "text-destructive" : isNegative ? "text-green-600" : "text-muted-foreground";
    return (
      <span className={cn("text-xs flex items-center", color)}>
        <Icon className="h-3 w-3 mr-0.5" />
        {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  // --- Render States ---
  // Loading based on session status
  if (sessionStatus === 'loading') {
    console.log("[DashboardOverview Render] Session Loading...");
    return <DashboardOverviewSkeleton />;
  }
  // Restricted view for non-admins
  if (sessionStatus === 'authenticated' && !isAdmin) {
    console.log("[DashboardOverview Render] Rendering Restricted View for non-admin.");
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
          <Lock className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Visão Geral Indisponível</h2>
          <p className="text-muted-foreground max-w-sm mb-6">O dashboard financeiro é exclusivo para administradores. Use o menu para acessar suas funções.</p>
          <Button variant="default" asChild>
              <Link href="/dashboard/despesas">
                  {session?.user?.role === 'manager' ? "Gerenciar Despesas" : "Registrar Despesa"}
              </Link>
          </Button>
           {session?.user?.role === 'manager' && (
                <Button variant="outline" asChild className="mt-4">
                    <Link href="/dashboard/empreendimentos">Ver Empreendimentos</Link>
               </Button>
           )}
      </motion.div>
    );
  }
  // Loading for admin while data fetches
  if ((isLoading || isFetchingFilters) && isAdmin) {
      console.log("[DashboardOverview Render] Admin view loading data (isLoading || isFetchingFilters)...");
      return <DashboardOverviewSkeleton />;
  }
  // Error view for admin
  if (error && !isLoading && isAdmin) {
    console.log("[DashboardOverview Render] Rendering Error View.");
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
          <Card className="w-full max-w-md border-destructive bg-destructive/10">
              <CardHeader><CardTitle className="text-destructive text-lg text-center">Erro ao Carregar</CardTitle></CardHeader>
              <CardContent className="text-center text-destructive/90">
                  <p>Não foi possível carregar o dashboard.</p>
                  <p className="text-xs mt-2">({error})</p>
                  <Button variant="destructive" size="sm" onClick={() => window.location.reload()} className="mt-4">Tentar Novamente</Button>
              </CardContent>
          </Card>
      </div>
    );
  }

  // --- Render Admin Dashboard Content ---
  if (isAdmin && dashboardData) {
      console.log("[DashboardOverview Render] Rendering Admin Dashboard Content.");
      const currentEmpreendimentoName = selectedEmpreendimentoId !== 'todos'
            ? empreendimentosList.find(e => e._id === selectedEmpreendimentoId)?.name ?? 'Empreendimento Selecionado'
            : 'Geral (Todos Empreendimentos)';

      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3 sm:pb-4">
             <div className="flex-1 min-w-0">
                 <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
                 <p className="text-sm text-muted-foreground mt-1 truncate" title={currentEmpreendimentoName}>
                    Visão {currentEmpreendimentoName}
                 </p>
             </div>
             <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
                 {/* Empreendimento Select */}
                 <Select
                     value={selectedEmpreendimentoId}
                     onValueChange={setSelectedEmpreendimentoId}
                     disabled={isFetchingFilters || isLoading}
                 >
                     <SelectTrigger className={cn("w-full sm:w-[200px] md:w-[240px] h-10", isFetchingFilters && "text-muted-foreground")}>
                         <SelectValue placeholder={isFetchingFilters ? "Carregando..." : (empreendimentosList.length === 0 ? "Nenhum Empr." : "Todos Empreend.")} />
                     </SelectTrigger>
                     <SelectContent>
                         <SelectItem value="todos">Todos Empreendimentos</SelectItem>
                         {!isFetchingFilters && empreendimentosList.map((emp) => (
                             <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                         ))}
                     </SelectContent>
                 </Select>
                 {/* Date Picker */}
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal sm:w-[240px] h-10",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            <span>
                                {date?.from ? (
                                    date.to ? (
                                        `${format(date.from, "dd/MM/yy", { locale: ptBR })} - ${format(date.to, "dd/MM/yy", { locale: ptBR })}`
                                    ) : (
                                        format(date.from, "dd/MM/yy", { locale: ptBR })
                                    )
                                ) : (
                                    "Selecione o período"
                                )}
                            </span>
                        </Button>
                    </PopoverTrigger>
                     <PopoverContent className="w-auto p-0" align="end">
                         <Calendar
                             initialFocus
                             mode="range"
                             defaultMonth={date?.from}
                             selected={date}
                             onSelect={setDate}
                             numberOfMonths={2}
                             locale={ptBR}
                         />
                     </PopoverContent>
                 </Popover>
                 {/* New Expense Button */}
                 <Button size="sm" asChild className="h-10 w-full sm:w-auto">
                     <Link href={`/dashboard/despesas/novo?empreendimento=${selectedEmpreendimentoId !== 'todos' ? selectedEmpreendimentoId : ''}`}>
                         <Plus className="mr-1.5 h-4 w-4" /> Nova Despesa
                     </Link>
                 </Button>
             </div>
          </div>

          {/* Stat Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 relative">
                {(isLoading || isFetchingFilters) && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                        <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                    </div>
                )}
                {/* Card Empreendimentos */}
                <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Empreendimentos</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="text-lg sm:text-2xl font-bold">{dashboardData.totalEmpreendimentos}</div>
                        <p className="text-xs text-muted-foreground">
                           {selectedEmpreendimentoId !== 'todos' ? 'Selecionado' : 'Total Cadastrados'}
                        </p>
                    </CardContent>
                </Card>

                {/* Card Total Registrado */}
                 <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                         <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Registrado</CardTitle>
                         <ListChecks className="h-4 w-4 text-muted-foreground" />
                     </CardHeader>
                     <CardContent className="p-0">
                         <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData.currentPeriod.totalAllValue)}</div>
                         <p className="text-xs text-muted-foreground mt-1">{dashboardData.currentPeriod.totalAllCount} despesa(s) no período</p>
                     </CardContent>
                 </Card>

                {/* Card Aguardando Aprovação */}
                 <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow border-orange-200 dark:border-orange-800/50">
                     <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                         <CardTitle className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-500">Aguard. Aprovação</CardTitle>
                         <Clock className="h-4 w-4 text-orange-600 dark:text-orange-500" />
                     </CardHeader>
                     <CardContent className="p-0">
                         <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData.pendingApproval?.value)}</div>
                         <p className="text-xs text-muted-foreground mt-1">{dashboardData.pendingApproval?.count ?? 0} despesa(s)</p>
                     </CardContent>
                 </Card>

                {/* Card Aprovadas a Vencer */}
                <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-500">Aprovadas a Vencer</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData.currentPeriod.dueValue)}</div>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">{dashboardData.currentPeriod.dueCount} despesa(s)</p>
                            {renderPendentComparison(dashboardData.comparison?.dueChange)}
                        </div>
                    </CardContent>
                </Card>

                {/* Card Aprovadas Pagas */}
                <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow border-green-200 dark:border-green-800/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                        <CardTitle className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-500">Aprovadas Pagas</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData.currentPeriod.paidValue)}</div>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">{dashboardData.currentPeriod.paidCount} despesa(s)</p>
                            {renderComparison(dashboardData.comparison?.paidChange)}
                        </div>
                    </CardContent>
                </Card>
             </div>

          {/* Charts and Recent Ventures */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
             {/* Expense Chart */}
             <Card className="col-span-1 lg:col-span-4">
                 <CardHeader>
                     <CardTitle className="text-base sm:text-lg">Despesas Mensais (Aprovadas)</CardTitle>
                     <CardDescription className="text-xs sm:text-sm">Visão geral das despesas aprovadas no período selecionado.</CardDescription>
                 </CardHeader>
                 <CardContent className="pl-2 pr-4 sm:pr-6 pb-4">
                     <ExpenseChart dateRange={date} empreendimentoId={selectedEmpreendimentoId} />
                 </CardContent>
             </Card>
             {/* Recent Ventures */}
             <Card className="col-span-1 lg:col-span-3 flex flex-col">
                 <CardHeader>
                     <CardTitle className="text-base sm:text-lg">Empreendimentos Recentes</CardTitle>
                     <CardDescription className="text-xs sm:text-sm">Últimos projetos atualizados ou com atividade recente.</CardDescription>
                 </CardHeader>
                 <CardContent className="flex-grow p-3">
                     <RecentVentures />
                 </CardContent>
                 <CardFooter className="p-3 border-t">
                     <Button variant="outline" size="sm" className="w-full h-9 text-xs sm:text-sm" asChild>
                         <Link href="/dashboard/empreendimentos">Ver Todos <ArrowRight className="ml-2 h-4 w-4" /></Link>
                     </Button>
                 </CardFooter>
             </Card>
          </div>
        </motion.div>
      );
  }

  // Final fallback if no condition matches (shouldn't happen in normal flow)
  console.log("[DashboardOverview Render] Reached final fallback return null.");
  return null;
}