// components/empreendimentos/empreendimentos-list.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    Building, Plus, Search, MoreHorizontal, MapPin, Calendar, Edit,
    LayoutGrid, List, Lock, Loader2, AlertTriangle, ThumbsUp,
    CheckCircle, BarChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, isValid } from "date-fns"; // Added isValid
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDebounce } from '@/utils/debounce';
import type {
    EmpreendimentoFilterParams,
    ClientEmpreendimento,
    EmpreendimentoStatus,
    EmpreendimentoType
} from '@/lib/trpc/types';

const ITEMS_PER_PAGE = 9;

// --- Animation Variants ---
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

// --- Helper: Get Badge Styles ---
const getBadgeStyles = (status: string): string => {
    const stylesMap: Record<string, string> = {
        "Concluído": "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
        "Em andamento": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
        "Planejamento": "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600"
    };
    return stylesMap[status] || "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600";
};

// --- Helper: Skeleton Card ---
const SkeletonCard = () => (
    <Card className="overflow-hidden flex flex-col animate-pulse">
        <Skeleton className="h-48 w-full" />
        <CardHeader className="pb-2 pt-3">
            <div className="flex justify-between items-start gap-2">
                 <Skeleton className="h-5 w-3/4 mb-1" />
                 <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <Skeleton className="h-3 w-full" />
        </CardHeader>
        <CardContent className="pb-3 flex-grow space-y-2">
             <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                 <div><Skeleton className="h-3 w-10 mb-1"/><Skeleton className="h-3 w-16"/></div>
                 <div><Skeleton className="h-3 w-12 mb-1"/><Skeleton className="h-3 w-10"/></div>
                 <div><Skeleton className="h-3 w-14 mb-1"/><Skeleton className="h-3 w-12"/></div>
                 <div><Skeleton className="h-3 w-10 mb-1"/><Skeleton className="h-3 w-14"/></div>
             </div>
        </CardContent>
        <CardFooter className="p-3">
            <Skeleton className="h-8 w-full rounded-md" />
        </CardFooter>
    </Card>
);
// --- Helper: Skeleton List Item ---
const SkeletonListItem = () => (
    <Card className="animate-pulse">
        <CardContent className="p-3 sm:p-4 flex gap-3 sm:gap-4">
            <Skeleton className="h-24 w-32 sm:w-40 md:w-48 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                </div>
                 <div className="flex justify-end pt-2"><Skeleton className="h-8 w-20 rounded-md"/></div>
            </div>
        </CardContent>
    </Card>
);
// --- Helper: Empty State (Types Corrected) ---
const EmptyState = ({ searchTerm, statusFilter, typeFilter, isAdmin }: {
    searchTerm: string;
    statusFilter?: EmpreendimentoStatus; // Expects only valid status or undefined
    typeFilter?: EmpreendimentoType;     // Expects only valid type or undefined
    isAdmin: boolean
}) => (
    <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Building className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum Empreendimento Encontrado</h3>
        <p className="text-muted-foreground mt-1 text-sm max-w-sm">
            {searchTerm || statusFilter || typeFilter ? "Tente ajustar os filtros de busca." : isAdmin ? "Você ainda não cadastrou nenhum empreendimento." : "Nenhum empreendimento encontrado para exibir."}
        </p>
        {isAdmin && !searchTerm && !statusFilter && !typeFilter && (
            <Button size="sm" className="mt-6" asChild>
                <Link href="/dashboard/empreendimentos/novo"><Plus className="mr-2 h-4 w-4" />Novo Empreendimento</Link>
            </Button>
        )}
    </motion.div>
);
// --- Helper: Pagination Controls ---
const PaginationControls = ({ currentPage, totalPages, totalItems, onPageChange, isLoading }: { currentPage: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void; isLoading: boolean; }) => (
    <motion.div variants={itemVariants} className="flex items-center justify-between pt-4 border-t mt-4">
        <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
        </span>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="h-9">Anterior</Button> {/* Corrected disable logic */}
            <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="h-9">Próxima</Button>
        </div>
    </motion.div>
);
// --- Helper: Grid Item ---
const GridItem = ({ emp, isAdmin }: { emp: ClientEmpreendimento; isAdmin: boolean }) => (
    <motion.div variants={itemVariants} layout>
        <Card className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
             <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block relative aspect-[16/9] bg-muted overflow-hidden group">
                <img src={emp.image || '/placeholder-logo.svg'}
                     alt={emp.name}
                     className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                     onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-logo.svg'; }}
                     loading="lazy"/>
                <Badge variant={"outline"} className={cn("absolute top-2 right-2 text-[10px] px-1.5 py-0.5", getBadgeStyles(emp.status))}>{emp.status}</Badge>
            </Link>
            <CardHeader className="pb-2 pt-3">
                 <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-base font-semibold leading-tight hover:text-primary">
                        <Link href={`/dashboard/empreendimentos/${emp._id}`} className="line-clamp-2" title={emp.name}>{emp.name}</Link>
                    </CardTitle>
                     {isAdmin && (
                         <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 -mt-1 -mr-2 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end">
                                 <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/editar`} className="flex items-center gap-2 cursor-pointer"><Edit className="h-4 w-4" />Editar</Link></DropdownMenuItem>
                                 <DropdownMenuItem asChild><Link href={`/dashboard/despesas/novo?empreendimento=${emp._id}`} className="flex items-center gap-2 cursor-pointer"><Plus className="h-4 w-4" />Nova Despesa</Link></DropdownMenuItem>
                             </DropdownMenuContent>
                         </DropdownMenu>
                     )}
                 </div>
                 <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 truncate" title={emp.address}><MapPin className="h-3 w-3 flex-shrink-0" />{emp.address}</CardDescription>
            </CardHeader>
             <CardContent className="pb-3 flex-grow text-xs space-y-1.5">
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="font-medium text-muted-foreground">Tipo:</span> {emp.type}</div>
                    <div><span className="font-medium text-muted-foreground">Unid.:</span> {emp.soldUnits}/{emp.totalUnits}</div>
                     {/* Safely format dates */}
                     <div><span className="font-medium text-muted-foreground">Início:</span> {emp.startDate && isValid(parseISO(emp.startDate)) ? format(parseISO(emp.startDate), "dd/MM/yy", { locale: ptBR }) : '-'}</div>
                     <div><span className="font-medium text-muted-foreground">Concl.:</span> {emp.endDate && isValid(parseISO(emp.endDate)) ? format(parseISO(emp.endDate), "dd/MM/yy", { locale: ptBR }) : '-'}</div>
                </div>
                 <div className="flex items-center gap-1 pt-1">
                     <Tooltip><TooltipTrigger>
                        <div className={cn("flex items-center text-xs gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>
                            {emp.pendingExpenses && emp.pendingExpenses > 0 ? <><AlertTriangle className="h-3 w-3" /> {emp.pendingExpenses} pend.</> : <><ThumbsUp className="h-3 w-3" /> Em dia</>}
                        </div>
                     </TooltipTrigger><TooltipContent><p>{emp.pendingExpenses && emp.pendingExpenses > 0 ? `${emp.pendingExpenses} despesa(s) pendente(s).` : "Nenhuma despesa pendente."}</p></TooltipContent></Tooltip>
                 </div>
            </CardContent>
            <CardFooter className="p-3 border-t">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                     <Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link>
                </Button>
            </CardFooter>
        </Card>
    </motion.div>
);
// --- Helper: List Item ---
const ListItem = ({ emp, isAdmin }: { emp: ClientEmpreendimento; isAdmin: boolean }) => (
    <motion.div variants={itemVariants} layout>
        <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                 <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block flex-shrink-0 w-full sm:w-40 md:w-48 aspect-[16/10] sm:aspect-[4/3] rounded-md overflow-hidden bg-muted group">
                     <img src={emp.image || '/placeholder-logo.svg'}
                          alt={emp.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder-logo.svg'; }}
                          loading="lazy" />
                 </Link>
                 <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                            <CardTitle className="text-base sm:text-lg font-semibold leading-tight hover:text-primary">
                                <Link href={`/dashboard/empreendimentos/${emp._id}`} className="line-clamp-2" title={emp.name}>{emp.name}</Link>
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate" title={emp.address}><MapPin className="h-3 w-3 flex-shrink-0" />{emp.address}</CardDescription>
                        </div>
                         <Badge variant={"outline"} className={cn("text-[10px] px-1.5 py-0.5 flex-shrink-0", getBadgeStyles(emp.status))}>{emp.status}</Badge>
                     </div>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2 text-muted-foreground">
                         <div><span className="font-medium text-foreground">Tipo:</span> {emp.type}</div>
                         <div><span className="font-medium text-foreground">Unid.:</span> {emp.soldUnits}/{emp.totalUnits}</div>
                         {/* Safely format dates */}
                         <div><span className="font-medium text-foreground">Início:</span> {emp.startDate && isValid(parseISO(emp.startDate)) ? format(parseISO(emp.startDate), "dd/MM/yy", { locale: ptBR }) : '-'}</div>
                         <div><span className="font-medium text-foreground">Concl.:</span> {emp.endDate && isValid(parseISO(emp.endDate)) ? format(parseISO(emp.endDate), "dd/MM/yy", { locale: ptBR }) : '-'}</div>
                     </div>
                     <div className="flex items-center justify-between mt-3 pt-2 border-t">
                         <Tooltip><TooltipTrigger>
                             <div className={cn("flex items-center text-xs gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>
                                 {emp.pendingExpenses && emp.pendingExpenses > 0 ? <><AlertTriangle className="h-3.5 w-3.5" /> {emp.pendingExpenses} Pend.</> : <><ThumbsUp className="h-3.5 w-3.5" /> Em Dia</>}
                             </div>
                         </TooltipTrigger><TooltipContent><p>{emp.pendingExpenses && emp.pendingExpenses > 0 ? `${emp.pendingExpenses} despesa(s) pendente(s).` : "Nenhuma despesa pendente."}</p></TooltipContent></Tooltip>

                         <div className="flex items-center gap-1">
                            {isAdmin && (
                                 <Button variant="outline" size="sm" className="h-8 px-2 text-xs" asChild>
                                     <Link href={`/dashboard/empreendimentos/${emp._id}/editar`}><Edit className="h-3.5 w-3.5 mr-1"/> Editar</Link>
                                 </Button>
                             )}
                             <Button variant="default" size="sm" className="h-8 px-2 text-xs" asChild>
                                 <Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Mais</Link>
                             </Button>
                         </div>
                     </div>
                 </div>
            </CardContent>
        </Card>
    </motion.div>
);


// --- Funções Auxiliares (getValidStatusFilter, getValidTypeFilter) - Mantidas ---
const getValidStatusFilter = (status: string | null): EmpreendimentoStatus | undefined => {
     const allowedStatus: EmpreendimentoStatus[] = ["Planejamento", "Em andamento", "Concluído"]; return allowedStatus.includes(status as EmpreendimentoStatus) ? status as EmpreendimentoStatus : undefined;
};
const getValidTypeFilter = (type: string | null): EmpreendimentoType | undefined => {
     const allowedType: EmpreendimentoType[] = ["Residencial", "Comercial", "Misto", "Industrial"]; return allowedType.includes(type as EmpreendimentoType) ? type as EmpreendimentoType : undefined;
};


// --- Main Component ---
export default function EmpreendimentosList() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // Estado local de filtros (sem alterações na inicialização)
    const [localFilters, setLocalFilters] = useState<EmpreendimentoFilterParams>(() => {
        const page = parseInt(searchParams.get("page") || "1", 10);
        const statusParam = searchParams.get("status");
        const typeParam = searchParams.get("type");
        const searchTermParam = searchParams.get("q");
        return { page: isNaN(page) || page < 1 ? 1 : page, limit: ITEMS_PER_PAGE, searchTerm: searchTermParam || undefined, status: getValidStatusFilter(statusParam), type: getValidTypeFilter(typeParam), };
    });

    // Estado de viewMode (sem alterações)
    const [viewMode, setViewMode] = useState(() => { /* ... */
         const view = searchParams.get("view"); return view === 'list' || view === 'grid' ? view : 'grid';
    });

    const debouncedSearchTerm = useDebounce(localFilters.searchTerm, 500);

    // Hook useEmpreendimentos (sem alterações)
    const {
        empreendimentos,
        totalEmpreendimentos,
        totalPages,
        isLoading: isHookLoading,
        isFetching: isHookFetching,
        updateFilters,
    } = useEmpreendimentos();

    const isLoading = isHookLoading || isHookFetching;
    const isAdmin = useMemo(() => sessionStatus === 'authenticated' && session?.user?.role === "admin", [session, sessionStatus]);
    const isManager = useMemo(() => sessionStatus === 'authenticated' && session?.user?.role === "manager", [session, sessionStatus]);

    // summaryCounts (sem alterações)
    const summaryCounts = useMemo(() => { /* ... */
        return (empreendimentos || []).reduce((acc, emp) => { acc.total++; if (emp.status === 'Em andamento') acc.inProgress++; else if (emp.status === 'Concluído') acc.completed++; else if (emp.status === 'Planejamento') acc.planning++; return acc; }, { total: 0, inProgress: 0, completed: 0, planning: 0 });
    }, [empreendimentos]);

    // updateQueryParamsAndLocalState (sem alterações)
    const updateQueryParamsAndLocalState = useCallback((newFilters: Partial<EmpreendimentoFilterParams>) => { /* ... */
         setLocalFilters((prev: EmpreendimentoFilterParams) => { const mergedFilters = { ...prev, ...newFilters }; if (Object.keys(newFilters).some(k => k !== 'page')) mergedFilters.page = 1; const params = new URLSearchParams(); if (mergedFilters.searchTerm) params.set("q", mergedFilters.searchTerm); if (mergedFilters.status) params.set("status", mergedFilters.status); if (mergedFilters.type) params.set("type", mergedFilters.type); params.set("view", viewMode); params.set("page", String(mergedFilters.page)); router.replace(`/dashboard/empreendimentos?${params.toString()}`, { scroll: false }); return mergedFilters; });
    }, [router, viewMode]);

    // useEffect para chamar updateFilters (sem alterações)
    useEffect(() => { /* ... */
         if (sessionStatus === 'authenticated') { updateFilters({ page: localFilters.page, limit: localFilters.limit, searchTerm: debouncedSearchTerm, status: localFilters.status, type: localFilters.type, }); }
    }, [localFilters, debouncedSearchTerm, updateFilters, sessionStatus]);

    // Handlers (sem alterações)
    const handlePageChange = (page: number) => updateQueryParamsAndLocalState({ page });
    const handleStatusChange = (value: string) => updateQueryParamsAndLocalState({ status: value === 'todos' ? undefined : (getValidStatusFilter(value)) });    
    const handleTypeChange = (value: string) => updateQueryParamsAndLocalState({ type: value === 'todos' ? undefined : (getValidTypeFilter(value)) });    
    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => updateQueryParamsAndLocalState({ searchTerm: event.target.value });
    const handleViewModeChange = (value: string) => { /* ... */
         if (value === 'grid' || value === 'list') { setViewMode(value); const params = new URLSearchParams(searchParams); params.set("view", value); router.replace(`/dashboard/empreendimentos?${params.toString()}`, { scroll: false }); }
    };

    // --- Loading State ---
    if (sessionStatus === 'loading') {
        return ( /* ... Skeleton JSX ... */
             <div className="space-y-6 px-4 sm:px-0 animate-pulse"> <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4"><div className="space-y-2"><Skeleton className="h-7 w-48 rounded-md" /><Skeleton className="h-4 w-64 rounded-md" /></div><Skeleton className="h-9 w-full sm:w-[110px] rounded-md" /></div> <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[...Array(4)].map((_,i)=><Skeleton key={`sum-skel-${i}`} className="h-24 w-full rounded-lg"/>)}</div> <div className="space-y-4"><Skeleton className="h-9 w-full rounded-md" /><div className="flex flex-col sm:flex-row gap-2 justify-between items-center"><div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"><Skeleton className="h-9 w-full sm:w-36 rounded-md" /><Skeleton className="h-9 w-full sm:w-36 rounded-md" /></div><Skeleton className="h-9 w-20 rounded-md" /></div></div> <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => <SkeletonCard key={`skel-g-${i}`} />)}</div> <div className="flex items-center justify-between pt-4 border-t"><Skeleton className="h-5 w-32 rounded-md" /><div className="flex gap-2"><Skeleton className="h-9 w-20 rounded-md" /><Skeleton className="h-9 w-20 rounded-md" /></div></div> </div>
         );
    }


    return (
        <TooltipProvider>
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 px-4 sm:px-0">
                {/* Header */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
                    {/* ... */}
                     <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">Empreendimentos</h2><p className="text-muted-foreground text-sm">Gerencie seus projetos imobiliários.</p></div> {isAdmin && (<Button size="sm" asChild className="h-9 w-full sm:w-auto text-sm"><Link href="/dashboard/empreendimentos/novo"><Plus className="mr-2 h-4 w-4" />Novo</Link></Button>)} {!isAdmin && isManager && (<div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-1.5 bg-muted/50"><Lock className="h-4 w-4" /><span>Somente Visualização</span></div>)}
                </motion.div>

                {/* Summary Cards */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* ... */}
                    <Card><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Total</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.total}</div></CardContent></Card> <Card><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Em Andamento</CardTitle><Loader2 className="h-4 w-4 text-blue-500 animate-spin" /></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.inProgress}</div></CardContent></Card> <Card><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Concluídos</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.completed}</div></CardContent></Card> <Card><CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Planejamento</CardTitle><BarChart className="h-4 w-4 text-gray-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.planning}</div></CardContent></Card>
                </motion.div>

                {/* Filters and View Mode */}
                <motion.div variants={itemVariants} className="space-y-4">
                    {/* ... */}
                     <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar por nome ou endereço..." className="pl-8 w-full text-sm h-9" value={localFilters.searchTerm ?? ''} onChange={handleSearchChange} disabled={isLoading}/></div> <div className="flex flex-col sm:flex-row gap-2 justify-between items-center"> <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto"> <Select value={localFilters.status ?? 'todos'} onValueChange={handleStatusChange} disabled={isLoading}> <SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todos Status</SelectItem> <SelectItem value="Planejamento">Planejamento</SelectItem> <SelectItem value="Em andamento">Em andamento</SelectItem> <SelectItem value="Concluído">Concluído</SelectItem> </SelectContent> </Select> <Select value={localFilters.type ?? 'todos'} onValueChange={handleTypeChange} disabled={isLoading}> <SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todos Tipos</SelectItem> <SelectItem value="Residencial">Residencial</SelectItem> <SelectItem value="Comercial">Comercial</SelectItem> <SelectItem value="Misto">Misto</SelectItem> <SelectItem value="Industrial">Industrial</SelectItem> </SelectContent> </Select> </div> <Tabs value={viewMode} onValueChange={handleViewModeChange} className="w-full sm:w-auto"><TabsList className="grid grid-cols-2 w-full sm:w-auto h-9"><Tooltip><TooltipTrigger asChild><TabsTrigger value="grid" className="h-full px-3" disabled={isLoading}><LayoutGrid className="h-4 w-4" /></TabsTrigger></TooltipTrigger><TooltipContent><p>Grade</p></TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><TabsTrigger value="list" className="h-full px-3" disabled={isLoading}><List className="h-4 w-4" /></TabsTrigger></TooltipTrigger><TooltipContent><p>Lista</p></TooltipContent></Tooltip></TabsList></Tabs> </div>
                </motion.div>

                {/* Content Area */}
                <motion.div variants={containerVariants} className={viewMode === 'grid' ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
                    {isLoading ? (
                         viewMode === "grid"
                             ? Array.from({ length: localFilters.limit || ITEMS_PER_PAGE }).map((_, i) => <SkeletonCard key={`skel-g-${i}`} />)
                             : Array.from({ length: 5 }).map((_, i) => <SkeletonListItem key={`skel-l-${i}`} />)
                     ) : empreendimentos.length > 0 ? (
                         empreendimentos.map(emp =>
                            viewMode === 'grid'
                                ? <GridItem key={emp._id} emp={emp} isAdmin={isAdmin} />
                                : <ListItem key={emp._id} emp={emp} isAdmin={isAdmin} />
                         )
                     ) : (
                         <div className={viewMode === 'grid' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                             <EmptyState
                                 searchTerm={localFilters.searchTerm ?? ''}
                                 statusFilter={localFilters.status}
                                 typeFilter={localFilters.type}
                                 isAdmin={isAdmin}
                              />
                         </div>
                     )}
                </motion.div>


                {/* Pagination */}
                 {/* Usa totalPages e totalEmpreendimentos do hook */}
                 {!isLoading && totalPages && totalPages > 1 && (
                    <PaginationControls
                        currentPage={localFilters.page || 1}
                        totalPages={totalPages}
                        totalItems={totalEmpreendimentos}
                        onPageChange={handlePageChange}
                        isLoading={isLoading}/>
                 )}
            </motion.div>
        </TooltipProvider>
    );
}