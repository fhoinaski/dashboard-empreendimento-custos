"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, Download, BarChart3, PieChart, TrendingUp, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

// --- TYPE DEFINITIONS ---
interface EmpreendimentoOption { _id: string; name: string; }
interface MonthlyExpense { name: string; total: number; }
interface CategoryExpense { name: string; value: number; }
interface ComparisonData { name: string; planejado: number; realizado: number; }
interface ReportDataState {
  monthlyExpenses: MonthlyExpense[];
  categoryExpenses: CategoryExpense[];
  comparison: ComparisonData[];
  empreendimentos: EmpreendimentoOption[];
}

const COLORS = ["#2dd4bf", "#5eead4", "#14b8a6", "#0d9488", "#0f766e", "#047857", "#065f46"];

// --- DEFINIÇÃO DAS VARIÁVEIS DE ANIMAÇÃO ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } }, };
const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 }, };
// --- FIM DA DEFINIÇÃO ---

export default function RelatoriosPage() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role;
  const [activeTab, setActiveTab] = useState("despesas");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()),
  });
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("todos");
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<ReportDataState>({ monthlyExpenses: [], categoryExpenses: [], comparison: [], empreendimentos: [] });
  const { toast } = useToast();

  const availableTabs = useMemo(() => {
    const tabs = [
      { value: "despesas", icon: BarChart3, label: "Despesas", roles: ["admin"] },
      { value: "categorias", icon: PieChart, label: "Categorias", roles: ["admin"] },
      { value: "comparativo", icon: TrendingUp, label: "Comparativo", roles: ["admin"] },
    ];
    return tabs;
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !availableTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(availableTabs[0]?.value || "despesas");
    }
  }, [status, availableTabs, activeTab]);

  // Fetch Empreendimentos
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      if (status !== 'authenticated' || userRole !== 'admin') { setIsFetchingFilters(false); setData(prev => ({...prev, empreendimentos: []})); return; }
      setIsFetchingFilters(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999");
        if (!response.ok) throw new Error("Erro ao buscar empreendimentos");
        const empreendimentosData = await response.json();
        if (isMounted && empreendimentosData?.empreendimentos) {
          setData((prevData) => ({ ...prevData, empreendimentos: empreendimentosData.empreendimentos as EmpreendimentoOption[] }));
        }
      } catch (error) { if (isMounted) { console.error("Erro filtro empreendimentos:", error); toast({ variant: "destructive", title: "Erro Filtro", description: "Não foi possível carregar." }); setData(prev => ({...prev, empreendimentos: []})); } }
      finally { if (isMounted) setIsFetchingFilters(false); }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false; };
  }, [status, userRole, toast]);

  // Fetch report data
  useEffect(() => {
    if (status !== 'authenticated' || userRole !== 'admin' || isFetchingFilters) return;
    const currentFromDate = dateRange?.from;
    const currentToDate = dateRange?.to;
    if (!currentFromDate || !currentToDate) { setIsLoading(false); return; }

    let isMounted = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        if (!currentFromDate || !currentToDate) return;
        const fromISO = currentFromDate.toISOString();
        const toISO = endOfDay(currentToDate).toISOString();
        const empParam = empreendimentoFilter === "todos" ? "" : `&empreendimento=${empreendimentoFilter}`;
        const [monthlyRes, categoryRes, comparisonRes] = await Promise.all([
          fetch(`/api/despesas/monthly?from=${fromISO}&to=${toISO}${empParam}`),
          fetch(`/api/despesas/categories?from=${fromISO}&to=${toISO}${empParam}`),
          fetch(`/api/despesas/comparison?from=${fromISO}&to=${toISO}${empParam}`),
        ]);
        if (!monthlyRes.ok || !categoryRes.ok || !comparisonRes.ok) { throw new Error(`Falha ao carregar dados (Status: ${monthlyRes.status}, ${categoryRes.status}, ${comparisonRes.status})`); }
        const [monthlyData, categoryData, comparisonData] = await Promise.all([ monthlyRes.json(), categoryRes.json(), comparisonRes.json(), ]);
        if (isMounted) { setData((prevData) => ({ ...prevData, monthlyExpenses: monthlyData || [], categoryExpenses: categoryData || [], comparison: comparisonData || [], })); }
      } catch (error) { if (isMounted) { console.error("Erro relatórios:", error); setData(prev => ({ ...prev, monthlyExpenses: [], categoryExpenses: [], comparison: [] })); toast({ variant: "destructive", title: "Erro Relatórios", description: error instanceof Error ? error.message : "Falha." }); } }
      finally { if (isMounted) setIsLoading(false); }
    }
    fetchData();
    return () => { isMounted = false; };
  }, [dateRange, empreendimentoFilter, isFetchingFilters, status, userRole, toast]);

  const metrics = useMemo(() => {
    const monthly = data.monthlyExpenses;
    if (!monthly || monthly.length === 0) return { total: 0, mediaMensal: 0, maxMonth: { name: "N/A", total: 0 } };
    const total = monthly.reduce((sum, item) => sum + (item.total || 0), 0);
    const mediaMensal = monthly.length > 0 ? total / monthly.length : 0;
    const maxMonth = monthly.reduce((max, item) => ((item.total || 0) > (max.total || 0) ? item : max), monthly[0] || { name: "N/A", total: 0 });
    return { total, mediaMensal, maxMonth };
  }, [data.monthlyExpenses]);

  const handleExportData = useCallback(async () => {
    setIsExporting(true); await new Promise(resolve => setTimeout(resolve, 1500)); toast({ title: "Exportação Concluída", description: "Relatório exportado (simulação)." }); setIsExporting(false);
  }, [toast]);

  // --- Loading / Unauthenticated State ---
  if (status === "loading" || (status === 'authenticated' && userRole === 'admin' && isFetchingFilters)) {
     return (<div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">{/* Skeleton content */}</div>);
  }
  // RBAC handled by page.tsx

  // --- Render Page ---
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">Relatórios</h2><p className="text-sm text-muted-foreground">Análise detalhada das despesas.</p></div>
        <Button variant="outline" onClick={handleExportData} disabled={isLoading || isExporting} className="w-full sm:w-auto h-9">{isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} {isExporting ? "Exportando..." : "Exportar"}</Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-auto justify-start text-left font-normal h-9", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (dateRange.to ? (`${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yy", { locale: ptBR })}`) : format(dateRange.from, "dd/MM/yy", { locale: ptBR })) : ("Selecione")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}/></PopoverContent>
        </Popover>
        <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter} disabled={isLoading}>
          <SelectTrigger className="w-full sm:w-64 h-9"><SelectValue placeholder="Empreendimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Empreendimentos</SelectItem>
            {data.empreendimentos.map((emp) => (<SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
         <TabsList className={`grid w-full h-auto grid-cols-3 max-w-[450px]`}>
             {availableTabs.map((tab) => (<TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 text-xs sm:text-sm h-9"><tab.icon className="h-4 w-4" /> {tab.label}</TabsTrigger>))}
         </TabsList>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="mt-0">
            {/* Despesas Tab Content */}
            {activeTab === "despesas" && (
              <motion.div variants={itemVariants} className="space-y-6">
                 <Card><CardHeader><CardTitle>Despesas Mensais</CardTitle><CardDescription>Evolução</CardDescription></CardHeader><CardContent className="h-[350px]">{isLoading ? (<Skeleton className="h-full w-full" />) : (<ResponsiveContainer>{/* BarChart */}<BarChart data={data.monthlyExpenses}><CartesianGrid/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer>)}</CardContent></Card>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <motion.div variants={itemVariants}><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Despesas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-3/4"/> : `R$ ${metrics.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</div></CardContent></Card></motion.div>
                      <motion.div variants={itemVariants}><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Média Mensal</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-3/4"/> : `R$ ${metrics.mediaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</div></CardContent></Card></motion.div>
                      <motion.div variants={itemVariants}><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Mês de Pico</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-1/2"/> : metrics.maxMonth.name || "N/A"}</div>
                            {/* --- CORREÇÃO AQUI: Substituir <p> por <div> --- */}
                            <div className="text-xs text-muted-foreground">
                                {isLoading ? <Skeleton className="h-3 w-3/4 mt-1"/> : metrics.maxMonth.total > 0 ? `(R$ ${metrics.maxMonth.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : ""}
                            </div>
                            {/* --- FIM DA CORREÇÃO --- */}
                        </CardContent>
                      </Card></motion.div>
                 </div>
              </motion.div>
            )}
            {/* Categorias Tab Content */}
            {activeTab === "categorias" && (
              <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card><CardHeader><CardTitle>Por Categoria</CardTitle><CardDescription>%</CardDescription></CardHeader><CardContent className="h-[400px]">{isLoading ? (<Skeleton className="h-full w-full" />) : (<ResponsiveContainer>{/* PieChart */}<RechartsPieChart><Pie data={data.categoryExpenses} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} fill="#8884d8" label>{data.categoryExpenses.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip/><Legend/></RechartsPieChart></ResponsiveContainer>)}</CardContent></Card>
                 <Card><CardHeader><CardTitle>Detalhamento</CardTitle><CardDescription>Valores</CardDescription></CardHeader><CardContent className="space-y-3 max-h-[400px] overflow-y-auto pr-2">{isLoading ? (<Skeleton className="h-[200px] w-full" />) : data.categoryExpenses.sort((a,b)=>b.value-a.value).map((category, index) => (<div key={category.name} className="space-y-1"><div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}/><span className="font-medium">{category.name}</span></div><span className="font-medium">R$ {category.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div><div className="w-full bg-muted rounded-full h-2"><div className="h-full rounded-full" style={{ width: `${metrics.total > 0 ? (category.value / metrics.total) * 100 : 0}%`, backgroundColor: COLORS[index % COLORS.length] }}/></div></div>))}</CardContent></Card>
              </motion.div>
            )}
             {/* Comparativo Tab Content */}
             {activeTab === "comparativo" && (
              <motion.div variants={itemVariants} className="space-y-6">
                  <Card><CardHeader><CardTitle>Comparativo: Planejado vs. Realizado</CardTitle><CardDescription>Despesas por empreendimento</CardDescription></CardHeader><CardContent className="h-[400px]">{isLoading ? (<Skeleton className="h-full w-full" />) : (<ResponsiveContainer>{/* BarChart */}<BarChart data={data.comparison}><CartesianGrid/><XAxis dataKey="name" angle={-30} textAnchor="end" height={70} interval={0} fontSize={10}/><YAxis fontSize={10} tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(0)+'k':v}`}/><Tooltip/><Legend wrapperStyle={{fontSize: '12px'}}/><Bar dataKey="planejado" fill={COLORS[1]} name="Planejado" radius={[4, 4, 0, 0]}/><Bar dataKey="realizado" fill={COLORS[0]} name="Realizado" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer>)}</CardContent></Card>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}