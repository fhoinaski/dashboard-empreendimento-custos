"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Building, Receipt, AlertTriangle, CheckCircle, ArrowRight, Calendar as CalendarIcon,
    TrendingUp, TrendingDown, Minus, DollarSign, Loader2, Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { RecentVentures } from "./recent-ventures";
import { ExpenseChart } from "./expense-chart";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DashboardOverviewSkeleton = () => {
    return (
      <div className="space-y-4 sm:space-y-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3 sm:pb-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
          </div>
           <Skeleton className="h-10 w-full sm:w-64 rounded-md" />
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`stat-skel-${i}`} className="p-3 sm:p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </CardHeader>
              <CardContent className="p-0">
                <Skeleton className="h-7 w-24 mb-1 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </CardContent>
               <CardFooter className="p-0 pt-2">
                  <Skeleton className="h-8 w-full rounded-md" />
               </CardFooter>
            </Card>
          ))}
        </div>
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
            <CardContent className="flex-grow space-y-3 p-3">
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
};

interface DashboardData {
    totalEmpreendimentos: number;
    currentPeriod: {
        despesasPendentes: number; despesasPendentesCount: number;
        despesasPagas: number; despesasPagasCount: number;
        totalDespesas: number; totalDespesasCount: number;
    };
    comparison?: {
        totalDespesasChange: number | null;
        despesasPendentesChange: number | null;
        despesasPagasChange: number | null;
    };
    upcomingExpenses?: { count: number; value: number; };
}

interface EmpreendimentoOption { _id: string; name: string; }

export default function DashboardOverview() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("todos");
  const [empreendimentosList, setEmpreendimentosList] = useState<EmpreendimentoOption[]>([]);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true);

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      setIsFetchingFilters(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999");
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
        const data = await response.json();
        if (isMounted && data && Array.isArray(data.empreendimentos)) {
          setEmpreendimentosList(data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name })));
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar lista de empreendimentos:", error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os empreendimentos para filtro." });
          setEmpreendimentosList([]);
        }
      } finally {
        if (isMounted) setIsFetchingFilters(false);
      }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, [toast]);


  useEffect(() => {
    let isMounted = true;
    async function fetchDashboardData() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (date?.from) params.set("from", date.from.toISOString());
      if (date?.to) params.set("to", endOfDay(date.to).toISOString());
      if (selectedEmpreendimentoId !== 'todos') {
          params.set("empreendimentoId", selectedEmpreendimentoId);
      }

      try {
        const response = await fetch(`/api/dashboard?${params.toString()}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ details: "Erro desconhecido." }));
            throw new Error(errorData.details || `Erro ${response.status}`);
        }
        const data: DashboardData = await response.json();
        if (isMounted) setDashboardData(data);
      } catch (err) {
          if(isMounted){
            const errorMessage = err instanceof Error ? err.message : "Falha ao carregar dados.";
            console.error("Erro ao carregar dados do dashboard:", err);
            setError(errorMessage);
            setDashboardData(null);
            toast({ variant: "destructive", title: "Erro ao Carregar", description: errorMessage });
          }
      } finally {
        if(isMounted) setIsLoading(false);
      }
    }
    fetchDashboardData();
    return () => { isMounted = false };
  }, [date, selectedEmpreendimentoId, toast]);

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

   const renderComparison = (change: number | null | undefined) => {
     if (change === null || change === undefined || isNaN(change)) {
       return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-1" /> --</span>;
     }
     const isPositive = change > 0;
     const isNegative = change < 0;
     let Icon = Minus;
     let colorClass = "text-muted-foreground";

     if (change !== 0) {
         Icon = isPositive ? TrendingUp : TrendingDown;
         colorClass = isPositive ? "text-green-600" : "text-red-600";
     }

     return (
       <span className={cn("flex items-center text-xs", colorClass)}>
         <Icon className="h-3 w-3 mr-1" />
         {isPositive ? '+' : ''}{change.toFixed(1)}%
       </span>
     );
   };

    const renderPendentComparison = (change: number | null | undefined) => {
     if (change === null || change === undefined || isNaN(change)) {
       return <span className="flex items-center text-xs text-muted-foreground"><Minus className="h-3 w-3 mr-1" /> --</span>;
     }
     const isPositive = change > 0;
     const isNegative = change < 0;
     const Icon = change !== 0 ? (isPositive ? TrendingUp : TrendingDown) : Minus;
     const colorClass = change !== 0 ? (isPositive ? "text-red-600" : "text-green-600") : "text-muted-foreground";

     return (
       <span className={cn("flex items-center text-xs", colorClass)}>
         <Icon className="h-3 w-3 mr-1" />
         {isPositive ? '+' : ''}{change.toFixed(1)}%
       </span>
     );
   };

  if (isLoading && !dashboardData) return <DashboardOverviewSkeleton />;

   if (error && !isLoading && !dashboardData) {
       return (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
              <Card className="w-full max-w-md border-destructive bg-destructive/10">
                  <CardHeader>
                      <CardTitle className="text-destructive text-lg text-center">Erro ao Carregar Dados</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-destructive/90">
                      <p>Não foi possível carregar as informações.</p>
                      <p className="text-xs mt-2">({error})</p>
                      <Button variant="destructive" size="sm" onClick={() => window.location.reload()} className="mt-4">
                          Tentar Novamente
                      </Button>
                  </CardContent>
              </Card>
          </div>
       );
   }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3 sm:pb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            Visão geral {selectedEmpreendimentoId !== 'todos' ? `de ${empreendimentosList.find(e=>e._id === selectedEmpreendimentoId)?.name ?? '...'}` : 'geral'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
            <Select
                value={selectedEmpreendimentoId}
                onValueChange={setSelectedEmpreendimentoId}
                disabled={isFetchingFilters || isLoading}
            >
                <SelectTrigger className={cn("w-full sm:w-[200px] md:w-[240px] h-10", isFetchingFilters && "text-muted-foreground")}>
                    <SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Todos Empreend."} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="todos">Todos Empreendimentos</SelectItem>
                    {empreendimentosList.map((emp) => (
                        <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Popover>
                <PopoverTrigger asChild>
                    <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal sm:w-[240px] h-10",!date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (date.to ? (<>{format(date.from, "dd/MM/yy", {locale: ptBR})} - {format(date.to, "dd/MM/yy", {locale: ptBR})}</>) : (format(date.from, "dd/MM/yy", {locale: ptBR}))) : (<span>Selecione o período</span>)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={ptBR}/>
                </PopoverContent>
            </Popover>
            {/* BOTÃO CORRIGIDO ABAIXO */}
            <Button
              size="sm"
              asChild
              className="h-10 w-full sm:w-auto"
            >
              <Link href={
                selectedEmpreendimentoId !== 'todos'
                  ? `/dashboard/despesas/novo?empreendimento=${selectedEmpreendimentoId}`
                  : `/dashboard/despesas/novo`
              }>
                <Plus className="mr-1.5 h-4 w-4" />
                Nova Despesa
              </Link>
            </Button>
        </div>
      </div>

       <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative">
            {isLoading && dashboardData && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                </div>
            )}
            <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                   <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Empreendimentos</CardTitle>
                   <Building className="h-4 w-4 text-muted-foreground" />
                 </CardHeader>
                 <CardContent className="p-0">
                   <div className="text-lg sm:text-2xl font-bold">{dashboardData?.totalEmpreendimentos ?? <Skeleton className="h-7 w-12 inline-block"/>}</div>
                    <p className="text-xs text-muted-foreground">Total cadastrado</p>
                 </CardContent>
               </Card>
            <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                   <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Despesas</CardTitle>
                   <DollarSign className="h-4 w-4 text-muted-foreground" />
                 </CardHeader>
                 <CardContent className="p-0">
                   <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.totalDespesas) ?? <Skeleton className="h-7 w-24 inline-block"/>}</div>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">{dashboardData?.currentPeriod?.totalDespesasCount ?? '-'} despesa(s)</p>
                        {renderComparison(dashboardData?.comparison?.totalDespesasChange)}
                    </div>
                 </CardContent>
               </Card>
            <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow border-amber-200 dark:border-amber-800/50">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                   <CardTitle className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-500">Pendentes</CardTitle>
                   <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                 </CardHeader>
                 <CardContent className="p-0">
                   <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.despesasPendentes) ?? <Skeleton className="h-7 w-24 inline-block"/>}</div>
                    <div className="flex items-center justify-between mt-1">
                       <p className="text-xs text-muted-foreground">{dashboardData?.currentPeriod?.despesasPendentesCount ?? '-'} despesa(s)</p>
                        {renderPendentComparison(dashboardData?.comparison?.despesasPendentesChange)}
                    </div>
                 </CardContent>
               </Card>
             <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow border-green-200 dark:border-green-800/50">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-1 sm:pb-2">
                       <CardTitle className="text-xs sm:text-sm font-medium text-green-600 dark:text-green-500">Pagas</CardTitle>
                       <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                   </CardHeader>
                   <CardContent className="p-0">
                       <div className="text-lg sm:text-2xl font-bold">{formatCurrency(dashboardData?.currentPeriod?.despesasPagas) ?? <Skeleton className="h-7 w-24 inline-block"/>}</div>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">{dashboardData?.currentPeriod?.despesasPagasCount ?? '-'} despesa(s)</p>
                            {renderComparison(dashboardData?.comparison?.despesasPagasChange)}
                        </div>
                   </CardContent>
                </Card>
         </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Despesas Mensais (Período)</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Visão geral das despesas no período selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 pr-4 sm:pr-6 pb-4">
            <ExpenseChart dateRange={date} empreendimentoId={selectedEmpreendimentoId} />
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Empreendimentos Recentes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Últimos projetos atualizados.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-3">
            <RecentVentures />
          </CardContent>
          <CardFooter className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full h-9 text-xs sm:text-sm" asChild>
              <Link href="/dashboard/empreendimentos">
                Ver Todos Empreendimentos <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </motion.div>
  );
}