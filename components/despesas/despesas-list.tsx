// components/despesas/despesas-list.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, MoreHorizontal, CheckCircle, AlertTriangle, Clock, Download, Receipt, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ClientDespesa {
  _id: string; description: string; value: number; date: string; dueDate: string; status: string;
  empreendimento: { _id: string; name: string; }; category: string; paymentMethod?: string; createdBy?: string;
  attachments?: { fileId?: string; name?: string; url?: string; _id?: string }[]; createdAt: string; updatedAt: string;
}
interface EmpreendimentoOption { _id: string; name: string; }
interface DespesaSummary { totalValue: number; totalPaid: number; totalPending: number; countTotal: number; countPaid: number; countPending: number; }

const ITEMS_PER_PAGE = 15;

export default function DespesasList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [despesas, setDespesas] = useState<ClientDespesa[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [summaryData, setSummaryData] = useState<DespesaSummary | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | false>(false);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true);
  const [totalDespesas, setTotalDespesas] = useState(0);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || "todos");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState(searchParams.get('empreendimento') || "todos");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || "todos");
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  const uniqueCategories = useMemo(() => {
      const currentCats = despesas.map((d) => d.category);
      const standardCats = ["Material", "Serviço", "Equipamento", "Taxas", "Outros"];
      return Array.from(new Set([...standardCats, ...currentCats]));
  }, [despesas]);

  const totalPages = Math.ceil(totalDespesas / ITEMS_PER_PAGE);

  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
        setIsFetchingFilters(true);
        try {
            const response = await fetch("/api/empreendimentos?limit=999");
            if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
            const data = await response.json();
            if (isMounted && data && Array.isArray(data.empreendimentos)) {
                setEmpreendimentos(data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name })));
            }
        } catch (error) { console.error("Erro filtro empreendimentos:", error); }
        finally { if (isMounted) setIsFetchingFilters(false); }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchSummary() {
        if (isFetchingFilters) return;
        setIsLoadingSummary(true);
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (statusFilter !== 'todos') params.set('status', statusFilter);
        if (empreendimentoFilter !== 'todos') params.set('empreendimento', empreendimentoFilter);
        if (categoryFilter !== 'todos') params.set('category', categoryFilter);

        // --- LOG FRONTEND: Parâmetros enviados para o resumo ---
        console.log(`[DespesasList - fetchSummary] Enviando parâmetros: ${params.toString()}`);

        try {
            const response = await fetch(`/api/despesas/summary?${params.toString()}`);
            if (!response.ok) throw new Error(`Falha ao buscar resumo (${response.status})`);
            const data: DespesaSummary = await response.json();

            // --- LOG FRONTEND: Dados de resumo recebidos ---
            console.log("[DespesasList - fetchSummary] Dados recebidos:", data);

            if (isMounted) {
                setSummaryData(data);
                setTotalDespesas(data.countTotal || 0);
                 const newTotalPages = Math.ceil((data.countTotal || 0) / ITEMS_PER_PAGE);
                 if (currentPage > newTotalPages && newTotalPages > 0) {
                     setCurrentPage(newTotalPages);
                 } else if (newTotalPages === 0 && currentPage !== 1) {
                    setCurrentPage(1);
                 }
            }
        } catch (error) {
            if (isMounted) {
                console.error("Erro ao buscar resumo:", error);
                toast({ variant: "destructive", title: "Erro no Resumo", description: "Não foi possível carregar os totais." });
                setSummaryData({ totalValue: 0, totalPaid: 0, totalPending: 0, countTotal: 0, countPaid: 0, countPending: 0 });
                setTotalDespesas(0);
            }
        } finally {
            if (isMounted) setIsLoadingSummary(false);
        }
    }
    fetchSummary();
    return () => { isMounted = false };
  }, [searchTerm, statusFilter, empreendimentoFilter, categoryFilter, isFetchingFilters, toast]);


  useEffect(() => {
    let isMounted = true;
    const buildUrlParams = () => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('q', searchTerm);
        if (statusFilter !== 'todos') params.set('status', statusFilter);
        if (empreendimentoFilter !== 'todos') params.set('empreendimento', empreendimentoFilter);
        if (categoryFilter !== 'todos') params.set('category', categoryFilter);
        params.set('limit', String(ITEMS_PER_PAGE));
        params.set('page', String(currentPage));
        return params.toString();
    };
    const queryString = buildUrlParams();
    const currentQueryString = window.location.search.substring(1);
    if (queryString !== currentQueryString) {
      router.replace(`/dashboard/despesas?${queryString}`, { scroll: false });
    }

    async function fetchDespesasPage() {
        if (isFetchingFilters || isLoadingSummary) return;
        setIsLoadingList(true);
        try {
            // --- LOG FRONTEND: Parâmetros enviados para a lista ---
            console.log(`[DespesasList - fetchDespesasPage] Enviando parâmetros: ${queryString}`);
            const response = await fetch(`/api/despesas?${queryString}`);
            if (!response.ok) throw new Error(`Falha ao buscar página (${response.status})`);
            const data = await response.json();
             // --- LOG FRONTEND: Dados da lista recebidos ---
             console.log("[DespesasList - fetchDespesasPage] Dados recebidos:", data.despesas?.length, "itens");
            if (isMounted) {
                setDespesas(data.despesas || []);
                if (summaryData === null) setTotalDespesas(data.pagination?.total || 0);
            }
        } catch (error) {
            if (isMounted) {
                console.error("Erro ao buscar despesas:", error);
                toast({ variant: "destructive", title: "Erro na Lista", description: "Não foi possível carregar a lista." });
                setDespesas([]);
            }
        } finally {
            if (isMounted) setIsLoadingList(false);
        }
    }
    if (!isFetchingFilters && !isLoadingSummary) {
       fetchDespesasPage();
    }

    return () => { isMounted = false };
  }, [searchTerm, statusFilter, empreendimentoFilter, categoryFilter, currentPage, router, toast, isFetchingFilters, isLoadingSummary, summaryData]);

  const handleFilterChange = useCallback((setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  }, []);

  const handleMarkAsPaid = useCallback(async (id: string) => {
      setIsActionLoading(id);
      try {
          const formData = new FormData(); formData.append("status", "Pago");
          const response = await fetch(`/api/despesas/${id}`, { method: "PUT", body: formData });
          if (!response.ok) { const err = await response.json().catch(()=>({})); throw new Error(err.error || "Falha") }
          const updatedData = await response.json();

          setDespesas((prev) => prev.map((exp) => (exp._id === id ? { ...exp, status: updatedData.despesa.status, updatedAt: updatedData.despesa.updatedAt } : exp)));
          toast({ title: "Sucesso", description: "Despesa marcada como paga!" });

          setIsLoadingSummary(true);
          const params = new URLSearchParams();
          if (searchTerm) params.set('q', searchTerm);
          if (statusFilter !== 'todos') params.set('status', statusFilter);
          if (empreendimentoFilter !== 'todos') params.set('empreendimento', empreendimentoFilter);
          if (categoryFilter !== 'todos') params.set('category', categoryFilter);
          fetch(`/api/despesas/summary?${params.toString()}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error('Falha ao re-buscar resumo')))
            .then((data: DespesaSummary) => setSummaryData(data))
            .catch(err => {
                console.error("Erro ao re-buscar resumo pós-pagamento:", err);
                toast({ variant: "destructive", title: "Erro Resumo", description: "Não foi possível atualizar os totais." });
            })
            .finally(() => setIsLoadingSummary(false));

      } catch (error) { console.error("Erro ao marcar pago:", error); toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." }); }
      finally { setIsActionLoading(false); }
}, [toast, searchTerm, statusFilter, empreendimentoFilter, categoryFilter]);

  const handleExportData = useCallback(async () => {
    setIsActionLoading('export');
    toast({ title: "Iniciando exportação...", description: "Preparando arquivo CSV com filtros atuais." });
    try {
       const params = new URLSearchParams();
       if (searchTerm) params.set('q', searchTerm);
       if (statusFilter !== 'todos') params.set('status', statusFilter);
       if (empreendimentoFilter !== 'todos') params.set('empreendimento', empreendimentoFilter);
       if (categoryFilter !== 'todos') params.set('category', categoryFilter);
       params.set('limit', '9999');

       const response = await fetch(`/api/despesas?${params.toString()}`);
       if (!response.ok) throw new Error("Falha ao buscar dados completos para exportação");
       const data = await response.json();
       const allFilteredDespesas: ClientDespesa[] = data.despesas || [];

       if (allFilteredDespesas.length === 0) {
          toast({ variant: "default", title: "Exportação", description: "Nenhuma despesa encontrada para exportar com os filtros atuais." });
          setIsActionLoading(false);
          return;
       }

      const csvHeader = "ID,Descrição,Valor,Status,Data,Vencimento,Empreendimento,Categoria,Pagamento\n";
      const csvRows = allFilteredDespesas.map(d =>
          [ `"${d._id}"`, `"${d.description.replace(/"/g, '""')}"`, `"${d.value.toFixed(2).replace('.', ',')}"`, `"${d.status}"`, `"${format(new Date(d.date), 'dd/MM/yyyy')}"`, `"${format(new Date(d.dueDate), 'dd/MM/yyyy')}"`, `"${d.empreendimento?.name.replace(/"/g, '""') ?? 'N/A'}"`, `"${d.category}"`, `"${d.paymentMethod?.replace(/"/g, '""') ?? ''}"` ].join(',')
      ).join('\n');
      const csvData = csvHeader + csvRows;
      const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url); link.setAttribute("download", `despesas_filtradas_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        toast({ title: "Exportação Concluída", description: `${allFilteredDespesas.length} despesa(s) exportada(s).` });
      } else { throw new Error("Download não suportado."); }
    } catch (error) { console.error("Erro ao exportar:", error); toast({ variant: "destructive", title: "Erro na Exportação", description: error instanceof Error ? error.message : "Não foi possível gerar o arquivo." }); }
    finally { setIsActionLoading(false); }
  }, [toast, searchTerm, statusFilter, empreendimentoFilter, categoryFilter]);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 }}};
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 }};
  const TableRowMotion = motion(TableRow);

  // --- LOG FRONTEND: Estado atual do resumo antes de renderizar ---
  console.log('[DespesasList - Render] Current summaryData:', summaryData);

  return (
    <TooltipProvider>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
           <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Despesas</h2>
            <p className="text-muted-foreground text-sm">Gerencie e filtre as despesas.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportData} disabled={!!isActionLoading || totalDespesas === 0} className="h-9 w-full sm:w-auto text-sm">
              {isActionLoading === 'export' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Exportar CSV
            </Button>
            <Button size="sm" asChild className="h-9 w-full sm:w-auto text-sm">
              <Link href="/dashboard/despesas/novo"> <Plus className="mr-2 h-4 w-4" /> Nova Despesa </Link>
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-3 relative">
            {isLoadingSummary && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-primary"/>
                </div>
            )}
            <Card className={cn(isLoadingSummary && "opacity-50")}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Valor Total <span className="text-muted-foreground font-normal">(Filtro)</span></CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">R$ {(summaryData?.totalValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{summaryData?.countTotal ?? 0} despesa(s) no total</p>
                </CardContent>
            </Card>
            <Card className={cn(isLoadingSummary && "opacity-50")}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Pago <span className="text-muted-foreground font-normal">(Filtro)</span></CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">R$ {(summaryData?.totalPaid ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{summaryData?.countPaid ?? 0} despesa(s)</p>
                </CardContent>
            </Card>
            <Card className={cn(isLoadingSummary && "opacity-50")}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Pendente <span className="text-muted-foreground font-normal">(Filtro)</span></CardTitle></CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-amber-600">R$ {(summaryData?.totalPending ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">{summaryData?.countPending ?? 0} despesa(s)</p>
                </CardContent>
            </Card>
        </motion.div>

        {/* Filters */}
        <motion.div variants={itemVariants} className="space-y-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Buscar por descrição..." className="pl-8 w-full text-sm h-9" value={searchTerm} onChange={handleSearchChange} disabled={isLoadingList || isFetchingFilters}/>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)} disabled={isLoadingList || isLoadingSummary}>
                <SelectTrigger className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-[150px] text-sm h-9"> <SelectValue placeholder="Status" /> </SelectTrigger>
                <SelectContent> <SelectItem value="todos">Todos Status</SelectItem> <SelectItem value="Pago">Pago</SelectItem> <SelectItem value="Pendente">Pendente</SelectItem> <SelectItem value="A vencer">A vencer</SelectItem> </SelectContent>
                </Select>
                <Select value={empreendimentoFilter} onValueChange={handleFilterChange(setEmpreendimentoFilter)} disabled={isFetchingFilters || isLoadingList || isLoadingSummary}>
                <SelectTrigger className={cn("w-full sm:w-auto sm:flex-1 md:flex-none md:w-[200px] text-sm h-9", isFetchingFilters && "text-muted-foreground")}> <SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Empreendimento"} /> </SelectTrigger>
                <SelectContent> <SelectItem value="todos">Todos Empreendimentos</SelectItem> {empreendimentos.map((emp) => (<SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>))} </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={handleFilterChange(setCategoryFilter)} disabled={isLoadingList || isLoadingSummary}>
                <SelectTrigger className="w-full sm:w-auto sm:flex-1 md:flex-none md:w-[160px] text-sm h-9"> <SelectValue placeholder="Categoria" /> </SelectTrigger>
                <SelectContent> <SelectItem value="todos">Todas Categorias</SelectItem> {uniqueCategories.map((category) => (<SelectItem key={category} value={category}>{category}</SelectItem>))} </SelectContent>
                </Select>
            </div>
        </motion.div>

        {/* Lista/Tabela */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-0">
                {/* Mobile View */}
                <div className="block sm:hidden divide-y divide-border">
                    {isLoadingList && Array.from({ length: 5 }).map((_, index) => ( <div key={`skel-mobile-${index}`} className="p-3 space-y-2 animate-pulse"><div className="flex justify-between items-start gap-2"><div className="flex-1 space-y-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div><div className="flex-shrink-0 space-y-1 items-end flex flex-col"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-7 w-14 mt-1" /></div></div></div> ))}
                    {!isLoadingList && despesas.map((despesa) => (
                         <motion.div key={`mobile-${despesa._id}`} variants={itemVariants} layout className="p-3">
                             <div className="flex justify-between items-start gap-2">
                                 <div className="flex-1 min-w-0 space-y-0.5">
                                     <p className="text-sm font-medium truncate" title={despesa.description}>{despesa.description}</p>
                                     <p className="text-xs text-muted-foreground truncate" title={despesa.empreendimento.name}>
                                         <Link href={`/dashboard/empreendimentos/${despesa.empreendimento._id}`} className="hover:underline">
                                             {despesa.empreendimento.name}
                                         </Link>
                                     </p>
                                     <p className="text-sm font-semibold">R$ {despesa.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                     <p className="text-xs text-muted-foreground">Vence: {format(new Date(despesa.dueDate), "dd/MM/yy")}</p>
                                 </div>
                                 <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                     <Badge variant={despesa.status === "Pago" ? "outline" : despesa.status === "Pendente" ? "destructive" : "secondary"} className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap", despesa.status === "Pago" && "border-green-500 text-green-700 bg-green-50", despesa.status === "Pendente" && "border-red-500 text-red-700 bg-red-50", despesa.status === "A vencer" && "border-amber-500 text-amber-700 bg-amber-50")}>
                                         <span className="flex items-center gap-1">{despesa.status === "Pago" ? <CheckCircle className="h-2.5 w-2.5" /> : despesa.status === "Pendente" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}{despesa.status}</span>
                                     </Badge>
                                     <div className="flex gap-1 mt-1">
                                         {despesa.status !== "Pago" && (
                                             <Button variant="outline" size="icon" onClick={() => handleMarkAsPaid(despesa._id)} className="h-7 w-7" disabled={!!isActionLoading} aria-label="Marcar como Pago">
                                                 {isActionLoading === despesa._id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle className="h-3.5 w-3.5 text-green-600"/>}
                                             </Button>
                                         )}
                                         <DropdownMenu>
                                             <DropdownMenuTrigger asChild>
                                                 <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!!isActionLoading}>
                                                     <MoreHorizontal className="h-4 w-4" /><span className="sr-only">Ações</span>
                                                 </Button>
                                             </DropdownMenuTrigger>
                                             <DropdownMenuContent align="end">
                                                 <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                 <DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}`}>Ver detalhes</Link></DropdownMenuItem>
                                                 <DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}/editar`}>Editar</Link></DropdownMenuItem>
                                                 {despesa.attachments && despesa.attachments.length > 0 && despesa.attachments[0]?.url && (<> <DropdownMenuSeparator /><DropdownMenuItem asChild><a href={despesa.attachments[0].url} target="_blank" rel="noopener noreferrer">Ver comprovante</a></DropdownMenuItem></>)}
                                             </DropdownMenuContent>
                                         </DropdownMenu>
                                     </div>
                                 </div>
                             </div>
                         </motion.div>
                    ))}
                </div>
                {/* Desktop View */}
                <div className="hidden sm:block overflow-x-auto">
                    <Table className="min-w-[700px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-4 py-3 text-xs w-[30%]">Descrição</TableHead>
                                <TableHead className="px-4 py-3 text-xs w-[20%]">Empreendimento</TableHead>
                                <TableHead className="px-4 py-3 text-xs w-[15%] text-right">Valor</TableHead>
                                <TableHead className="px-4 py-3 text-xs w-[15%] text-center">Vencimento</TableHead>
                                <TableHead className="px-4 py-3 text-xs w-[10%] text-center">Status</TableHead>
                                <TableHead className="px-4 py-3 text-xs w-[10%] text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingList && Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={`skel-desktop-${index}`} className="animate-pulse">
                                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-full" /></TableCell>
                                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-full" /></TableCell>
                                    <TableCell className="px-4 py-3 text-right"><Skeleton className="h-4 w-1/2 ml-auto" /></TableCell>
                                    <TableCell className="px-4 py-3 text-center"><Skeleton className="h-4 w-3/4 mx-auto" /></TableCell>
                                    <TableCell className="px-4 py-3 text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></TableCell>
                                    <TableCell className="px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoadingList && despesas.map((despesa) => (
                                <TableRowMotion key={despesa._id} variants={itemVariants} layout>
                                    <TableCell className="font-medium text-sm px-4 py-3">
                                        <span className="truncate block max-w-[250px]" title={despesa.description}>{despesa.description}</span>
                                        {despesa.attachments && despesa.attachments.length > 0 && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge variant="secondary" className="ml-1 text-xs cursor-default">Anexo</Badge>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Possui comprovante</p></TooltipContent>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm px-4 py-3">
                                        <Link href={`/dashboard/empreendimentos/${despesa.empreendimento._id}`} className="text-primary hover:underline truncate block max-w-[200px]" title={despesa.empreendimento.name}>
                                            {despesa.empreendimento.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm px-4 py-3 text-right">R$ {despesa.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-sm px-4 py-3 text-center">{format(new Date(despesa.dueDate), "dd/MM/yy")}</TableCell>
                                    <TableCell className="text-sm px-4 py-3 text-center">
                                        <Badge variant={despesa.status === "Pago" ? "outline" : despesa.status === "Pendente" ? "destructive" : "secondary"} className={cn("text-xs whitespace-nowrap", despesa.status === "Pago" && "border-green-500 text-green-700 bg-green-50", despesa.status === "Pendente" && "border-red-500 text-red-700 bg-red-50", despesa.status === "A vencer" && "border-amber-500 text-amber-700 bg-amber-50")}>
                                            <span className="flex items-center gap-1">{despesa.status === "Pago" ? <CheckCircle className="h-3 w-3" /> : despesa.status === "Pendente" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{despesa.status}</span>
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right px-4 py-3">
                                        <div className="flex justify-end items-center gap-1">
                                            {despesa.status !== "Pago" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="outline" size="sm" onClick={() => handleMarkAsPaid(despesa._id)} disabled={!!isActionLoading} className="h-8 w-8 p-0" aria-label="Marcar Pago">
                                                            {isActionLoading === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Marcar como Pago</p></TooltipContent>
                                                </Tooltip>
                                            )}
                                            <DropdownMenu>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!isActionLoading}>
                                                                <MoreHorizontal className="h-4 w-4" /><span className="sr-only">Ações</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Mais Ações</p></TooltipContent>
                                                </Tooltip>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                    <DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}`}>Ver detalhes</Link></DropdownMenuItem>
                                                    <DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}/editar`}>Editar</Link></DropdownMenuItem>
                                                    {despesa.attachments && despesa.attachments.length > 0 && despesa.attachments[0]?.url && (<> <DropdownMenuSeparator /><DropdownMenuItem asChild><a href={despesa.attachments[0].url} target="_blank" rel="noopener noreferrer">Ver comprovante</a></DropdownMenuItem></>)}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRowMotion>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {!isLoadingList && despesas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">Nenhuma despesa encontrada</h3>
                        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
                            {searchTerm || statusFilter !== 'todos' || empreendimentoFilter !== 'todos' || categoryFilter !== 'todos' ? "Tente ajustar os filtros de busca." : "Comece adicionando uma nova despesa."}
                        </p>
                        <Button size="sm" className="mt-6" asChild>
                            <Link href="/dashboard/despesas/novo"><Plus className="mr-2 h-4 w-4" />Nova Despesa</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                 <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} ({totalDespesas} itens)
                </span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || isLoadingList} className="h-9">Anterior</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || isLoadingList} className="h-9">Próxima</Button>
                 </div>
              </div>
            )}
          </Card>
        </motion.div>

      </motion.div>
    </TooltipProvider>
  );
}