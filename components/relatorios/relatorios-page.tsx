"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, Download, BarChart3, PieChart, TrendingUp, Loader2 } from "lucide-react"; // Added Loader2
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
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
  PieChart as RechartsPieChart, // Alias to avoid naming conflict
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loading } from "@/components/ui/loading";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading states

// --- TYPE DEFINITIONS ---
interface EmpreendimentoOption {
  _id: string;
  name: string;
  // Add other fields if needed
}

interface MonthlyExpense {
  name: string; // e.g., "Jan"
  total: number;
}

interface CategoryExpense {
  name: string; // e.g., "Material"
  value: number;
}

interface ComparisonData {
  name: string; // Empreendimento name
  planejado: number;
  realizado: number;
}

// Define the structure of the data state
interface ReportDataState {
  monthlyExpenses: MonthlyExpense[];
  categoryExpenses: CategoryExpense[];
  comparison: ComparisonData[];
  empreendimentos: EmpreendimentoOption[];
}

// Colors for charts
const COLORS = ["#2dd4bf", "#5eead4", "#14b8a6", "#0d9488", "#0f766e", "#047857", "#065f46"];

export default function RelatoriosPage() {
  const [activeTab, setActiveTab] = useState("despesas");
  // Correctly type useState for DateRange or undefined
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 1), // Start of current year
    to: new Date(), // Today
  });
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("todos");
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true); // Loading state for filters

  // Initialize state with correct types and empty arrays
  const [data, setData] = useState<ReportDataState>({
    monthlyExpenses: [],
    categoryExpenses: [],
    comparison: [],
    empreendimentos: [],
  });
  const { toast } = useToast();

  // Fetch Empreendimentos for the filter dropdown
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      setIsFetchingFilters(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999"); // Fetch all for filter
        if (!response.ok) throw new Error("Erro ao buscar empreendimentos para filtro");
        const empreendimentosData = await response.json();
        if (isMounted && empreendimentosData?.empreendimentos) {
          setData(prevData => ({
            ...prevData,
            empreendimentos: empreendimentosData.empreendimentos as EmpreendimentoOption[],
          }));
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao buscar empreendimentos (filtro):", error);
          toast({ title: "Erro Filtro", description: "Não foi possível carregar empreendimentos.", variant: "destructive" });
          setData(prevData => ({ ...prevData, empreendimentos: [] }));
        }
      } finally {
        if (isMounted) setIsFetchingFilters(false);
      }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false; };
  }, [toast]);

  // Fetch report data based on filters
  useEffect(() => {
    // Don't fetch report data until filters are loaded and dateRange is set
    if (isFetchingFilters || !dateRange?.from || !dateRange?.to) return;

    let isMounted = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        if (!dateRange?.from || !dateRange?.to) return;
        const fromISO = dateRange.from.toISOString();
        const toISO = dateRange.to.toISOString();
        const empParam = empreendimentoFilter === 'todos' ? '' : `&empreendimento=${empreendimentoFilter}`;

        // Fetch all report data concurrently
        const [monthlyRes, categoryRes, comparisonRes] = await Promise.all([
          fetch(`/api/despesas/monthly?from=${fromISO}&to=${toISO}${empParam}`),
          fetch(`/api/despesas/categories?from=${fromISO}&to=${toISO}${empParam}`),
          fetch(`/api/despesas/comparison?from=${fromISO}&to=${toISO}${empParam}`) // Comparison API might need adjustments
        ]);

        // Check all responses
        if (!monthlyRes.ok) throw new Error(`Erro ao buscar despesas mensais (${monthlyRes.status})`);
        if (!categoryRes.ok) throw new Error(`Erro ao buscar despesas por categoria (${categoryRes.status})`);
        if (!comparisonRes.ok) throw new Error(`Erro ao buscar comparativo (${comparisonRes.status})`);

        const [monthlyData, categoryData, comparisonData] = await Promise.all([
          monthlyRes.json(),
          categoryRes.json(),
          comparisonRes.json(),
        ]);

        if (isMounted) {
          // Update state with fetched data, ensuring types match
          setData(prevData => ({
            ...prevData, // Keep existing empreendimentos
            monthlyExpenses: monthlyData as MonthlyExpense[],
            categoryExpenses: categoryData as CategoryExpense[],
            comparison: comparisonData as ComparisonData[],
          }));
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao buscar dados dos relatórios:", error);
          // Set empty/default data on error to avoid breaking charts
          setData(prevData => ({
            ...prevData,
            monthlyExpenses: [],
            categoryExpenses: [],
            comparison: [],
          }));
          toast({
            title: "Erro ao Carregar Relatórios",
            description: error instanceof Error ? error.message : "Falha ao carregar dados.",
            variant: "destructive",
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchData();
    return () => { isMounted = false };
  }, [dateRange, empreendimentoFilter, isFetchingFilters, toast]); // Depend on filters and dateRange


  // Memoization of metrics
  const metrics = useMemo(() => {
    const monthly = data.monthlyExpenses;
    if (!monthly || monthly.length === 0) {
      return { total: 0, mediaMensal: 0, maxMonth: { name: "N/A", total: 0 } };
    }

    const total = monthly.reduce((sum, item) => sum + (item.total || 0), 0); // Safely access total
    const mediaMensal = total / monthly.length;
    const maxMonth = monthly.reduce(
      (max, item) => ((item.total || 0) > (max.total || 0) ? item : max),
      monthly[0] // Initial value for reduce
    );

    return { total, mediaMensal, maxMonth };
  }, [data.monthlyExpenses]);


  const handleExportData = () => {
    toast({
      title: "Exportação iniciada",
      description: "Seu relatório está sendo gerado...", // Changed to PDF later if needed
    });
    // Implement actual export logic (e.g., generate CSV or PDF)
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  // --- RENDER LOADING SKELETON ---
  if (isLoading || isFetchingFilters) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div className="space-y-1.5"><Skeleton className="h-6 w-32 rounded-md" /><Skeleton className="h-4 w-56 rounded-md" /></div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 w-full sm:w-56 rounded-md" />
          <Skeleton className="h-10 w-full sm:w-64 rounded-md" />
        </div>
        {/* Tabs Skeleton */}
        <Skeleton className="h-10 w-full max-w-[600px] rounded-md" />
        {/* Chart Area Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><Skeleton className="h-5 w-1/3 mb-2"/><Skeleton className="h-4 w-2/3"/></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-1/3 mb-2"/><Skeleton className="h-4 w-2/3"/></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  // --- RENDER ACTUAL PAGE ---
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 sm:p-6 lg:p-8" // Added padding
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-sm text-muted-foreground">Análise detalhada dos seus empreendimentos</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportData}
          className="w-full sm:w-auto transition-all hover:scale-105"
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto justify-start text-left font-normal hover:bg-muted transition-colors h-10" // Ensure consistent height
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from && dateRange?.to ? (
                `${format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - ${format(dateRange.to, "dd/MM/yy", { locale: ptBR })}`
              ) : (
                "Selecione o período"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              // Use the state setter correctly, ensuring it handles undefined
              onSelect={(range) => setDateRange(range)}
              numberOfMonths={typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2} // Conditional rendering for months
              className="border rounded-md"
            />
          </PopoverContent>
        </Popover>

        <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
          <SelectTrigger className="w-full sm:w-64 h-10"> {/* Consistent height */}
            <SelectValue placeholder="Empreendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os empreendimentos</SelectItem>
            {/* Use optional chaining and check length */}
            {data.empreendimentos?.length > 0 ? (
              data.empreendimentos.map((emp) => (
                // Use emp._id and emp.name
                <SelectItem key={emp._id} value={emp._id}>
                  {emp.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-4 text-sm text-muted-foreground text-center">Carregando...</div>
            )}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 gap-2 w-full max-w-[600px] mx-auto sm:mx-0 h-auto"> {/* h-auto for wrap */}
          {[
            { value: "despesas", icon: BarChart3, label: "Despesas" },
            { value: "categorias", icon: PieChart, label: "Categorias" },
            { value: "comparativo", icon: TrendingUp, label: "Comparativo" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center justify-center gap-2 py-2 text-xs sm:text-sm transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted h-10" // Consistent height
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab} // Change key to trigger animation
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="mt-0" // Remove default margin from TabsContent
          >
            {/* Despesas Tab */}
            {activeTab === 'despesas' && (
              <motion.div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Despesas Mensais</CardTitle>
                    <CardDescription>Evolução das despesas no período selecionado</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthlyExpenses}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        {/* Add type hint for v */}
                        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                        <Tooltip
                          formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, "Total"]}
                          labelFormatter={(label: string) => label}
                          contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "12px", padding: "8px 12px" }}
                          cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.6 }}
                        />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: "Total de Despesas", value: `R$ ${metrics.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                    { title: "Média Mensal", value: `R$ ${metrics.mediaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                    { title: "Mês de Pico", value: metrics.maxMonth.name || "N/A", sub: metrics.maxMonth.total > 0 ? `(R$ ${metrics.maxMonth.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '' },
                  ].map((metric) => (
                    <motion.div key={metric.title} variants={itemVariants}>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xl sm:text-2xl font-bold">{metric.value}</div>
                          {metric.sub && <p className="text-xs text-muted-foreground">{metric.sub}</p>}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Categorias Tab */}
            {activeTab === 'categorias' && (
              <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                  <CardHeader>
                    <CardTitle>Despesas por Categoria</CardTitle>
                    <CardDescription>Distribuição percentual das despesas</CardDescription>
                  </CardHeader>
                   <CardContent className="h-[300px] sm:h-[400px] flex items-center justify-center">
                    {data.categoryExpenses.length > 0 && data.categoryExpenses.some(c => c.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart margin={{ top: 10, right: 10, bottom: 40, left: 10 }}> {/* Adjust margin */}
                                <Pie
                                    data={data.categoryExpenses}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 120}
                                    fill="#8884d8"
                                    dataKey="value"
                                    // Conditional label rendering for small screens
                                    label={({ name, percent, innerRadius, outerRadius, cx, cy, midAngle, x, y }) => {
                                         if (typeof window !== 'undefined' && window.innerWidth < 768) return null; // Hide labels on small screens if needed
                                        const RADIAN = Math.PI / 180;
                                        const radius = innerRadius + (outerRadius - innerRadius) * 1.2; // Position label outside
                                        const lx = cx + radius * Math.cos(-midAngle * RADIAN);
                                        const ly = cy + radius * Math.sin(-midAngle * RADIAN);
                                        return (
                                            <text x={lx} y={ly} fill="hsl(var(--foreground))" textAnchor={lx > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
                                            {`${name} (${(percent * 100).toFixed(0)}%)`}
                                            </text>
                                        );
                                    }}
                                >
                                    {data.categoryExpenses.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--background))" />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, "Total"]} />
                                <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={10} wrapperStyle={{ fontSize: "12px" }}/>
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    ) : (
                         <p className="text-muted-foreground text-sm">Sem dados de categoria para exibir.</p>
                    )}
                    </CardContent>
                </Card>
                 <Card>
                  <CardHeader>
                    <CardTitle>Detalhamento por Categoria</CardTitle>
                    <CardDescription>Valores gastos em cada categoria</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {data.categoryExpenses.length > 0 ? data.categoryExpenses
                        .sort((a,b) => b.value - a.value) // Sort by value descending
                        .map((category, index) => (
                            <motion.div
                                key={category.name}
                                className="space-y-1.5"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                        <span className="font-medium">{category.name}</span>
                                    </div>
                                    <span className="font-medium">R$ {category.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                        style={{
                                        width: `${metrics.total > 0 ? (category.value / metrics.total) * 100 : 0}%`,
                                        backgroundColor: COLORS[index % COLORS.length],
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )) : <p className="text-muted-foreground text-sm text-center py-4">Sem dados de categoria.</p>}
                  </CardContent>
                </Card>
              </motion.div>
            )}

             {/* Comparativo Tab */}
             {activeTab === 'comparativo' && (
              <motion.div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Comparativo: Planejado vs. Realizado</CardTitle>
                    <CardDescription>Comparação de despesas por empreendimento no período</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.comparison} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        {/* Add type hint for v */}
                        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={50} interval={0} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, ""]} />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: '10px' }}/>
                        <Bar dataKey="planejado" fill={COLORS[1]} name="Planejado" radius={[4, 4, 0, 0]} barSize={25} />
                        <Bar dataKey="realizado" fill={COLORS[0]} name="Realizado" radius={[4, 4, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {/* Potentially add another comparative chart or table here */}
              </motion.div>
            )}

          </motion.div>
        </AnimatePresence>
      </Tabs>
    </motion.div>
  );
}