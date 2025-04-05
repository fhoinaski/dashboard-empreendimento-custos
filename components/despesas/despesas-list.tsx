// FILE: components/despesas/despesas-list.tsx
// STATUS: MODIFIED TO HANDLE PENDING APPROVAL FILTER AND FIX ERROR HANDLING

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus, Search, MoreHorizontal, CheckCircle, AlertTriangle, Clock, Download, Receipt,
  Loader2, ThumbsUp, ThumbsDown, Filter, Building, MessageSquareWarning, Info, Eye, Edit, DollarSign,
  XCircle, Hourglass, CalendarIcon as CalendarLucide, Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "next-auth/react";
import { Separator } from "../ui/separator";

// --- Interfaces ---
interface ClientDespesa {
  _id: string;
  description: string;
  value: number;
  date: string; // ISO String
  dueDate: string; // ISO String
  status: string; // Financial Status
  approvalStatus: string; // Approval Status
  empreendimento: { _id: string; name: string };
  category: string;
  paymentMethod?: string;
  createdBy?: { _id: string; name: string };
  reviewedBy?: { _id: string; name: string };
  attachments?: { fileId?: string; name?: string; url?: string; _id?: string }[];
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  reviewedAt?: string; // ISO String
}

interface EmpreendimentoOption {
  _id: string;
  name: string;
}

interface DespesaSummary {
  totalValue: number;
  totalPaid: number;
  totalPending: number;
  countTotal: number;
  countPaid: number;
  countPending: number;
}

// --- Constants ---
const ITEMS_PER_PAGE = 15;

// --- Helper Components (Skeletons, Empty State, Pagination) ---
const SkeletonRow = () => (
    <TableRow>
        <TableCell className="px-3 py-2"><Skeleton className="h-5 w-3/4" /></TableCell>
        <TableCell className="hidden lg:table-cell px-3 py-2"><Skeleton className="h-5 w-2/3" /></TableCell>
        <TableCell className="hidden md:table-cell px-3 py-2 text-right"><Skeleton className="h-5 w-16 inline-block" /></TableCell>
        <TableCell className="hidden sm:table-cell px-3 py-2 text-center"><Skeleton className="h-5 w-12 inline-block" /></TableCell>
        <TableCell className="hidden sm:table-cell px-3 py-2 text-center"><Skeleton className="h-6 w-20 inline-block rounded-full" /></TableCell>
        <TableCell className="hidden sm:table-cell px-3 py-2 text-center"><Skeleton className="h-6 w-20 inline-block rounded-full" /></TableCell>
        <TableCell className="px-3 py-2 text-right"><Skeleton className="h-8 w-8 inline-block rounded-md" /></TableCell>
    </TableRow>
);

const EmptyState = ({ filtersApplied, isAdmin }: { filtersApplied: boolean; isAdmin: boolean }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhuma despesa encontrada</h3>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            {filtersApplied
                ? "Tente ajustar os filtros para encontrar resultados."
                : "Adicione uma nova despesa para começar."}
        </p>
        <Button size="sm" className="mt-6" asChild>
            <Link href="/dashboard/despesas/novo"><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Link>
        </Button>
    </div>
);

const PaginationControls = ({ currentPage, totalPages, totalItems, onPageChange, isLoading }: { currentPage: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void; isLoading: boolean; }) => {
    if (totalPages <= 1) return null; // Don't show if only 1 page
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t mt-4">
            <span className="text-sm text-muted-foreground text-center sm:text-left">
                Página {currentPage} de {totalPages} ({totalItems} itens)
            </span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading} className="h-9">Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages || isLoading} className="h-9">Próxima</Button>
            </div>
        </div>
    );
};

const SummarySkeletonCard = () => (
    <Card className="animate-pulse">
        <CardHeader className="pb-2"><Skeleton className="h-4 w-2/3" /></CardHeader>
        <CardContent><Skeleton className="h-7 w-1/2 mb-1" /><Skeleton className="h-3 w-1/3" /></CardContent>
    </Card>
);
// --- End Helper Components ---

// --- Main Component ---
export default function DespesasList() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // State variables initialized from URL search params
  const [despesas, setDespesas] = useState<ClientDespesa[]>([]);
  const [totalDespesas, setTotalDespesas] = useState<number>(0);
  const [empreendimentos, setEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("status") || "todos");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>(() => searchParams.get("empreendimento") || "todos");
  const [categoryFilter, setCategoryFilter] = useState<string>(() => searchParams.get("category") || "todos");
  const [approvalFilter, setApprovalFilter] = useState<string>(() => searchParams.get("approvalStatus") || "todos");
  const [currentPage, setCurrentPage] = useState<number>(() => parseInt(searchParams.get("page") || "1", 10));

  // Loading states
  const [isFetchingFilters, setIsFetchingFilters] = useState<boolean>(true);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<string | boolean>(false);
  const [summaryData, setSummaryData] = useState<DespesaSummary | null>(null);

  // Permissions and derived state
  const userRole = useMemo(() => session?.user?.role, [session]);
  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);
  const isManager = useMemo(() => userRole === 'manager', [userRole]);
  const canReview = isAdmin;
  const totalPages = useMemo(() => Math.ceil(totalDespesas / ITEMS_PER_PAGE), [totalDespesas]);
  const filtersApplied = useMemo(() =>
      searchTerm !== "" ||
      statusFilter !== 'todos' ||
      empreendimentoFilter !== 'todos' ||
      categoryFilter !== 'todos' ||
      (isAdmin && approvalFilter !== 'todos'),
    [searchTerm, statusFilter, empreendimentoFilter, categoryFilter, isAdmin, approvalFilter]
  );

  const dropdownEmpreendimentos = useMemo(() => {
    if (!session?.user) return [];
    
    if (isAdmin || isManager) return empreendimentos;
    
    const assignedIds = session.user.assignedEmpreendimentos ? 
      new Set(session.user.assignedEmpreendimentos) : new Set();
      
    return empreendimentos.filter(emp => assignedIds.has(emp._id));
  }, [empreendimentos, session, isAdmin, isManager]);

  const uniqueCategories = useMemo(() => {
    const baseCategories = ["Material", "Serviço", "Equipamento", "Taxas", "Outros"];
    return baseCategories.sort();
  }, []);

  // --- Utility Functions ---
  const buildUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (statusFilter !== "todos") params.set("status", statusFilter);
    if (empreendimentoFilter !== "todos") params.set("empreendimento", empreendimentoFilter);
    if (categoryFilter !== "todos") params.set("category", categoryFilter);
    if (isAdmin && approvalFilter !== "todos") params.set("approvalStatus", approvalFilter);
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("page", String(currentPage));
    return params.toString();
  }, [searchTerm, statusFilter, empreendimentoFilter, categoryFilter, approvalFilter, isAdmin, currentPage]);

  const getFinancialStatusInfo = (status: string): { styles: string; icon: React.ElementType } => {
    const financialMap: Record<string, { styles: string; icon: React.ElementType }> = {
        Pago: { styles: "border-green-500 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-900/30", icon: CheckCircle },
        Pendente: { styles: "border-orange-500 text-orange-700 bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:bg-orange-900/30", icon: Clock },
        "A vencer": { styles: "border-amber-500 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-900/30", icon: Clock },
        Rejeitado: { styles: "border-red-500 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-900/30", icon: XCircle },
    };
    return financialMap[status] || { styles: "border-gray-500 text-gray-700 bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800/30", icon: Info };
  };

  const getApprovalStatusInfo = (status: string): { styles: string; icon: React.ElementType } => {
    const approvalMap: Record<string, { styles: string; icon: React.ElementType }> = {
        Aprovado: { styles: "border-green-500 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-300 dark:bg-green-900/30", icon: ThumbsUp },
        Pendente: { styles: "border-amber-500 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:bg-amber-900/30", icon: Hourglass },
        Rejeitado: { styles: "border-red-500 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-300 dark:bg-red-900/30", icon: ThumbsDown },
    };
    return approvalMap[status] || { styles: "border-gray-500 text-gray-700 bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800/30", icon: Info };
  };

  const formatCurrency = (value: number | undefined | null): string => value?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "R$ 0,00";

  // --- Data Fetching Logic (Corrigido) ---
  const fetchData = useCallback(async () => {
    if (sessionStatus !== 'authenticated') return;

    setIsLoadingList(true);
    if (isAdmin) setIsLoadingSummary(true);

    const queryString = buildUrlParams();
    router.replace(`/dashboard/despesas?${queryString}`, { scroll: false });

    try {
        // Fetch despesas
        const despesasResponse = await fetch(`/api/despesas?${queryString}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Garante que cookies de autenticação sejam enviados
        });

        console.log(`[FetchDespesas] Buscando despesas com query: ${queryString}`);

        if (!despesasResponse.ok) {
            const errorBody = await despesasResponse.text();
            console.error(`[FetchDespesas] Erro na API - Status: ${despesasResponse.status}`, { body: errorBody, url: despesasResponse.url });

            let errorMsg = `Falha ao carregar despesas (Status: ${despesasResponse.status})`;
            try {
                const parsedError = JSON.parse(errorBody);
                errorMsg = parsedError.error || parsedError.message || errorMsg;
            } catch (parseError) {
                console.warn('[FetchDespesas] Falha ao parsear erro da API:', parseError);
            }

            // Mapeamento de erros comuns
            switch (despesasResponse.status) {
                case 401:
                    errorMsg = 'Não autorizado. Faça login novamente.';
                    break;
                case 403:
                    errorMsg = 'Acesso negado. Permissões insuficientes.';
                    break;
                case 500:
                    errorMsg = 'Erro interno no servidor. Tente novamente mais tarde.';
                    break;
            }

            throw new Error(errorMsg);
        }

        const listData = await despesasResponse.json();

        // Validação dos dados retornados
        if (!listData || !Array.isArray(listData.despesas)) {
            console.error('[FetchDespesas] Dados inválidos recebidos:', listData);
            throw new Error('Formato de dados inválido retornado pela API');
        }

        setDespesas(listData.despesas);
        setTotalDespesas(listData.pagination?.total || 0);
        console.log(`[FetchDespesas] Carregadas ${listData.despesas.length} despesas.`);

        const newTotalPages = Math.ceil((listData.pagination?.total || 0) / ITEMS_PER_PAGE);
        if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
        } else if (newTotalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
        }

        // Fetch summary if admin
        if (isAdmin) {
            try {
                const summaryResponse = await fetch(`/api/despesas/summary?${queryString}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                });

                if (!summaryResponse.ok) {
                    const summaryErrorBody = await summaryResponse.text();
                    console.error(`[FetchSummary] Erro na API - Status: ${summaryResponse.status}`, { body: summaryErrorBody });
                    setSummaryData(null);
                } else {
                    const summaryData = await summaryResponse.json();
                    setSummaryData(summaryData);
                }
            } catch (summaryError) {
                console.error('[FetchSummary] Exceção capturada:', summaryError);
                setSummaryData(null);
            } finally {
                setIsLoadingSummary(false);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar despesas';
        console.error('[FetchDespesas] Exceção geral capturada:', error);
        toast({
            variant: "destructive",
            title: "Erro ao Carregar Lista",
            description: errorMessage,
        });
        setDespesas([]);
        setTotalDespesas(0);
    } finally {
        setIsLoadingList(false);
    }
  }, [sessionStatus, isAdmin, buildUrlParams, currentPage, router, toast]);

  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
        if (sessionStatus !== 'authenticated') { 
          setIsFetchingFilters(false); 
          return; 
        }
        
        setIsFetchingFilters(true);
        try {
            const response = await fetch("/api/empreendimentos?limit=999", {
                credentials: 'include',
            });
            if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
            
            const data = await response.json();
            if (isMounted && data?.empreendimentos) {
                setEmpreendimentos(data.empreendimentos.map((emp: any) => ({ 
                  _id: emp._id, 
                  name: emp.name 
                })));
            }
        } catch (error) {
            if (isMounted) { 
              console.error("Erro fetchEmpreendimentos:", error); 
              toast({ 
                variant: "destructive", 
                title: "Erro Filtro", 
                description: "Falha ao carregar empreendimentos." 
              }); 
              setEmpreendimentos([]); 
            }
        } finally { 
          if (isMounted) setIsFetchingFilters(false); 
        }
    }
    
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, [sessionStatus, toast]);

  useEffect(() => {
    if (!isFetchingFilters && sessionStatus === 'authenticated') {
      fetchData();
    }
  }, [
    searchTerm, statusFilter, empreendimentoFilter, categoryFilter, approvalFilter,
    currentPage, fetchData, isFetchingFilters, sessionStatus
  ]);

  // --- Action Handlers ---
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
      setter(value);
      setCurrentPage(1);
  };
  
  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1);
  };
  
  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
      }
  };

  const handleReview = useCallback(async (id: string, approved: boolean) => {
    if (!canReview) return;
    
    const action = approved ? 'approve' : 'reject';
    setIsActionLoading(`${action}-${id}`);
    
    try {
        const response = await fetch(`/api/despesas/${id}/review`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ approvalStatus: approved ? 'Aprovado' : 'Rejeitado' })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Falha na operação.`);

        toast({ title: "Sucesso!", description: data.message });
        fetchData();

    } catch (error) {
        toast({ 
          variant: "destructive", 
          title: "Erro", 
          description: error instanceof Error ? error.message : `Falha na operação.` 
        });
    } finally {
        setIsActionLoading(false);
    }
  }, [canReview, toast, fetchData]);

  const handleExportData = useCallback(async () => {
    setIsActionLoading('export');
    toast({ title: "Exportando...", description: "Gerando o relatório (simulação)." });
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ title: "Exportação Concluída", description: "O arquivo foi baixado (simulação)." });
    setIsActionLoading(false);
  }, [toast]);

  // --- Animation Variants ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
  const TableRowMotion = motion(TableRow);

  const showLoadingSkeleton = sessionStatus === 'loading' || isFetchingFilters || (isLoadingList && despesas.length === 0);

  if (showLoadingSkeleton) {
    return (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
                <div><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-56 mt-1" /></div>
                <div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-32" /></div>
            </div>
            {isAdmin && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><SummarySkeletonCard /><SummarySkeletonCard /><SummarySkeletonCard /></div>}
            <div className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-9 w-40" />
                    <Skeleton className="h-9 w-32" />
                    <Skeleton className="h-9 w-36" />
                    {isAdmin && <Skeleton className="h-9 w-32" />}
                </div>
            </div>
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                <TableHead><Skeleton className="h-5 w-20"/></TableHead>
                <TableHead className="hidden lg:table-cell"><Skeleton className="h-5 w-24"/></TableHead>
                <TableHead className="hidden md:table-cell"><Skeleton className="h-5 w-16"/></TableHead>
                <TableHead className="hidden sm:table-cell"><Skeleton className="h-5 w-12"/></TableHead>
                <TableHead className="hidden sm:table-cell"><Skeleton className="h-5 w-20"/></TableHead>
                <TableHead className="hidden sm:table-cell"><Skeleton className="h-5 w-20"/></TableHead>
                <TableHead><Skeleton className="h-5 w-10"/></TableHead>
            </TableRow></TableHeader><TableBody>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={`skel-${i}`}/>)}
            </TableBody></Table></div></CardContent></Card>
        </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 p-4 sm:p-6 lg:p-8">
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
           <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">Despesas</h2><p className="text-muted-foreground text-sm">Gerencie e acompanhe suas despesas.</p></div>
           <div className="flex flex-col sm:flex-row gap-2">
             {(isAdmin || isManager) && (<Button variant="outline" size="sm" onClick={handleExportData} disabled={!!isActionLoading || totalDespesas === 0} className="h-9"><Download className="mr-2 h-4 w-4" /> Exportar Visão</Button>)}
             <Button size="sm" asChild className="h-9"><Link href="/dashboard/despesas/novo"><Plus className="mr-2 h-4 w-4" /> Nova Despesa</Link></Button>
           </div>
        </motion.div>

        {isAdmin && (
             <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                 {isLoadingSummary ? ( <><SummarySkeletonCard /><SummarySkeletonCard /><SummarySkeletonCard /></> ) :
                 summaryData ? ( <>
                     <Card>
                         <CardHeader className="pb-2">
                             <CardTitle className="text-sm font-medium">Total (Filtro)</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <div className="text-2xl font-bold">{formatCurrency(summaryData.totalValue)}</div>
                             <p className="text-xs text-muted-foreground">{summaryData.countTotal} despesa(s)</p>
                         </CardContent>
                     </Card>
                     {approvalFilter === 'Pendente' ? (
                         <Card>
                             <CardHeader className="pb-2">
                                 <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-500">Pendente de Aprovação (Filtro)</CardTitle>
                             </CardHeader>
                             <CardContent>
                                 <div className="text-2xl font-bold text-orange-600">{formatCurrency(summaryData.totalValue)}</div>
                                 <p className="text-xs text-muted-foreground">{summaryData.countTotal} despesa(s)</p>
                             </CardContent>
                         </Card>
                     ) : (
                         <>
                             <Card>
                                 <CardHeader className="pb-2">
                                     <CardTitle className="text-sm font-medium">Pago (Filtro)</CardTitle>
                                 </CardHeader>
                                 <CardContent>
                                     <div className="text-2xl font-bold text-green-600">{formatCurrency(summaryData.totalPaid)}</div>
                                     <p className="text-xs text-muted-foreground">{summaryData.countPaid} despesa(s)</p>
                                 </CardContent>
                             </Card>
                             <Card>
                                 <CardHeader className="pb-2">
                                     <CardTitle className="text-sm font-medium">A Vencer (Filtro)</CardTitle>
                                 </CardHeader>
                                 <CardContent>
                                     <div className="text-2xl font-bold text-amber-600">{formatCurrency(summaryData.totalPending)}</div>
                                     <p className="text-xs text-muted-foreground">{summaryData.countPending} despesa(s)</p>
                                 </CardContent>
                             </Card>
                         </>
                     )}
                 </> ) : (<div className="sm:col-span-3 text-center text-muted-foreground p-4 border rounded-md bg-muted/50">Resumo não disponível.</div>)}
             </motion.div>
         )}

        <motion.div variants={itemVariants} className="space-y-4">
           <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar por descrição..." className="pl-8 w-full text-sm h-9" value={searchTerm} onChange={handleSearchTermChange} disabled={isLoadingList || isFetchingFilters}/></div>
           <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                {(isAdmin || isManager || dropdownEmpreendimentos.length > 0) && (
                    <Select value={empreendimentoFilter} onValueChange={(value) => handleFilterChange(setEmpreendimentoFilter, value)} disabled={isFetchingFilters || isLoadingList}>
                        <SelectTrigger className={cn("w-full sm:w-auto text-sm h-9 min-w-[150px]", isFetchingFilters && "text-muted-foreground")}><SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Empreendimento"} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos {(isAdmin || isManager) ? '' : 'Atribuídos'}</SelectItem>
                            {dropdownEmpreendimentos.length === 0 && !isFetchingFilters && (<div className="p-2 text-center text-xs text-muted-foreground">Nenhum disponível</div>)}
                            {dropdownEmpreendimentos.map(emp => <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <Select value={statusFilter} onValueChange={(value) => handleFilterChange(setStatusFilter, value)} disabled={isLoadingList}><SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[130px]"><SelectValue placeholder="Status Fin." /></SelectTrigger><SelectContent><SelectItem value="todos">Todos Status Fin.</SelectItem><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="A vencer">A vencer</SelectItem><SelectItem value="Rejeitado">Rejeitado</SelectItem></SelectContent></Select>
                <Select value={categoryFilter} onValueChange={(value) => handleFilterChange(setCategoryFilter, value)} disabled={isLoadingList}><SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[140px]"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas Categorias</SelectItem>{uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select>
                {isAdmin && (<Select value={approvalFilter} onValueChange={(value) => handleFilterChange(setApprovalFilter, value)} disabled={isLoadingList}><SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[130px]"><SelectValue placeholder="Aprovação" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas Aprov.</SelectItem><SelectItem value="Pendente">Pendentes</SelectItem><SelectItem value="Aprovado">Aprovadas</SelectItem><SelectItem value="Rejeitado">Rejeitadas</SelectItem></SelectContent></Select>)}
           </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap">Descrição</TableHead>
                      <TableHead className="hidden lg:table-cell px-3 py-2 text-xs whitespace-nowrap">Empreendimento</TableHead>
                      <TableHead className="hidden md:table-cell px-3 py-2 text-xs text-right whitespace-nowrap">Valor</TableHead>
                      <TableHead className="hidden sm:table-cell px-3 py-2 text-xs text-center whitespace-nowrap">Vencimento</TableHead>
                      <TableHead className="hidden sm:table-cell px-3 py-2 text-xs text-center whitespace-nowrap">Status Fin.</TableHead>
                      <TableHead className="hidden sm:table-cell px-3 py-2 text-xs text-center whitespace-nowrap">Status Apr.</TableHead>
                      <TableHead className="px-3 py-2 text-xs text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {isLoadingList && Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (<SkeletonRow key={`skel-${i}`} />))}
                    {!isLoadingList && despesas.map(despesa => {
                        const isCreator = session?.user?.id === despesa.createdBy?._id;
                        const canEditCurrent = isAdmin || (isCreator && despesa.approvalStatus === 'Pendente');
                        const isLoadingThisAction = typeof isActionLoading === 'string' && isActionLoading.endsWith(despesa._id);
                        const { styles: financialStyles, icon: FinancialIcon } = getFinancialStatusInfo(despesa.status);
                        const { styles: approvalStyles, icon: ApprovalIcon } = getApprovalStatusInfo(despesa.approvalStatus);

                        return (
                            <TableRowMotion key={despesa._id} variants={itemVariants} layout>
                                <TableCell className="font-medium text-sm px-3 py-2 align-top">
                                     <Link href={`/dashboard/despesas/${despesa._id}`} className="hover:text-primary hover:underline block truncate max-w-[180px] sm:max-w-[200px]" title={despesa.description}>{despesa.description}</Link>
                                     <div className="mt-1 space-y-0.5 sm:hidden text-xs text-muted-foreground">
                                         <div className="flex items-center gap-1 truncate" title={despesa.empreendimento.name}><Building className="h-3 w-3 shrink-0"/>{despesa.empreendimento.name}</div>
                                         <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 shrink-0"/>{formatCurrency(despesa.value)}</div>
                                         <div className="flex items-center gap-1"><CalendarLucide className="h-3 w-3 shrink-0"/>Vence: {format(parseISO(despesa.dueDate), "dd/MM/yy")}</div>
                                         <div className="flex flex-wrap gap-1 pt-1">
                                            <Badge variant="outline" className={cn("text-[10px] px-1 py-0", financialStyles)}><FinancialIcon className="h-2.5 w-2.5 mr-0.5"/>{despesa.status}</Badge>
                                            <Badge variant="outline" className={cn("text-[10px] px-1 py-0", approvalStyles)}><ApprovalIcon className="h-2.5 w-2.5 mr-0.5"/>{despesa.approvalStatus}</Badge>
                                         </div>
                                     </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm px-3 py-2 align-top"><span className="truncate block max-w-[150px]" title={despesa.empreendimento.name}>{despesa.empreendimento.name}</span></TableCell>
                                <TableCell className="hidden md:table-cell text-sm px-3 py-2 text-right align-top">{formatCurrency(despesa.value)}</TableCell>
                                <TableCell className="hidden sm:table-cell text-sm px-3 py-2 text-center align-top">{format(parseISO(despesa.dueDate), "dd/MM/yy")}</TableCell>
                                <TableCell className="hidden sm:table-cell text-sm px-3 py-2 text-center align-top"><Badge variant="outline" className={cn("text-xs", financialStyles)}><FinancialIcon className="h-3 w-3 mr-1" />{despesa.status}</Badge></TableCell>
                                <TableCell className="hidden sm:table-cell text-sm px-3 py-2 text-center align-top"><Badge variant="outline" className={cn("text-xs", approvalStyles)}><ApprovalIcon className="h-3 w-3 mr-1" />{despesa.approvalStatus}</Badge></TableCell>
                                <TableCell className="text-right px-3 py-2 align-top">
                                    <div className="flex justify-end items-center gap-1">
                                        {canReview && despesa.approvalStatus === "Pendente" && (
                                            <>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => handleReview(despesa._id, true)} disabled={isLoadingThisAction || !!isActionLoading} className="h-7 w-7 p-0 text-green-600 hover:bg-green-100">{isActionLoading === `approve-${despesa._id}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent><p>Aprovar</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => handleReview(despesa._id, false)} disabled={isLoadingThisAction || !!isActionLoading} className="h-7 w-7 p-0 text-red-600 hover:bg-red-100">{isActionLoading === `reject-${despesa._id}` ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent><p>Rejeitar</p></TooltipContent></Tooltip>
                                                <Separator orientation="vertical" className="h-5 mx-1" />
                                            </>
                                        )}
                                        <DropdownMenu>
                                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" disabled={isLoadingThisAction || !!isActionLoading}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Opções</p></TooltipContent></Tooltip>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}`} className="flex items-center"><Eye className="mr-2 h-4 w-4"/>Ver detalhes</Link></DropdownMenuItem>
                                                {canEditCurrent && (<DropdownMenuItem asChild><Link href={`/dashboard/despesas/${despesa._id}/editar`} className="flex items-center"><Edit className="mr-2 h-4 w-4"/>Editar</Link></DropdownMenuItem>)}
                                                {despesa.attachments?.[0]?.url && (<DropdownMenuItem asChild><a href={despesa.attachments[0].url} target="_blank" rel="noopener noreferrer" className="flex items-center"><Download className="mr-2 h-4 w-4"/>Ver comprovante</a></DropdownMenuItem>)}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRowMotion>
                        );
                    })}
                  </TableBody>
                </Table>
              </div>
              {!isLoadingList && despesas.length === 0 && (<EmptyState filtersApplied={filtersApplied} isAdmin={!!isAdmin} />)}
            </CardContent>
            <PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalDespesas} onPageChange={handlePageChange} isLoading={isLoadingList}/>
          </Card>
        </motion.div>
      </motion.div>
    </TooltipProvider>
  );
}