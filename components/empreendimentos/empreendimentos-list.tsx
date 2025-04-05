/* ================================== */
/* components/empreendimentos/empreendimentos-list.tsx (Corrected status destructuring) */
/* ================================== */
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added React import
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building, Plus, Search, MoreHorizontal, MapPin, Calendar, Edit, // Added Edit
  LayoutGrid, List, Lock, Loader2, AlertTriangle, ThumbsUp, // Icons
  CheckCircle, BarChart // Added icons for summary
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
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

// --- Interfaces ---
interface ClientEmpreendimento {
  _id: string; name: string; address: string; type: string; status: string;
  totalUnits: number; soldUnits: number; startDate: string; endDate: string;
  description?: string; responsiblePerson: string; contactEmail: string; contactPhone: string;
  image?: string; folderId?: string; sheetId?: string;
  pendingExpenses?: number; totalExpenses?: number;
  createdAt: string; updatedAt: string;
}

const ITEMS_PER_PAGE = 9;

// --- Animation Variants ---
const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
};

// --- Helper: Get Badge Styles ---
const getBadgeStyles = (status: string) => {
    return {
      Concluído: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
      "Em andamento": "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
      Planejamento: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600"
    }[status] || "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600";
};

// --- Helper: Skeleton Card ---
const SkeletonCard = () => (
  <Card className="overflow-hidden flex flex-col animate-pulse">
    <Skeleton className="h-48 w-full" />
    <CardHeader className="pb-2 pt-3"><Skeleton className="h-5 w-3/4 mb-1" /><Skeleton className="h-3 w-full" /></CardHeader>
    <CardContent className="pb-3 flex-grow space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></CardContent>
    <CardFooter className="p-3"><Skeleton className="h-8 w-full rounded-md" /></CardFooter>
  </Card>
);

// --- Helper: Skeleton List Item ---
const SkeletonListItem = () => (
  <Card className="animate-pulse">
    <CardContent className="p-3 sm:p-4 flex gap-3 sm:gap-4">
      <Skeleton className="h-24 w-32 sm:w-40 md:w-48 rounded-md flex-shrink-0" />
      <div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><div className="grid grid-cols-4 gap-4 pt-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div></div>
    </CardContent>
  </Card>
);

// --- Helper: Empty State ---
const EmptyState = ({ searchTerm, statusFilter, typeFilter, isAdmin, }: { searchTerm: string; statusFilter: string; typeFilter: string; isAdmin: boolean; }) => (
    <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-16 text-center px-4">
      <Building className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">Nenhum empreendimento encontrado</h3>
      <p className="text-muted-foreground mt-1 text-sm max-w-sm">
        {searchTerm || statusFilter !== "todos" || typeFilter !== "todos"
          ? "Tente ajustar os filtros de busca."
          : isAdmin
          ? "Você ainda não cadastrou nenhum empreendimento."
          : "Nenhum empreendimento encontrado para sua visualização."}
      </p>
      {isAdmin && (
        <Button size="sm" className="mt-6" asChild>
          <Link href="/dashboard/empreendimentos/novo"><Plus className="mr-2 h-4 w-4" /> Novo Empreendimento</Link>
        </Button>
      )}
    </motion.div>
  );

// --- Helper: Pagination Controls ---
const PaginationControls = ({ currentPage, totalPages, totalItems, onPageChange, isLoading }: { currentPage: number; totalPages: number; totalItems: number; onPageChange: (page: number) => void; isLoading: boolean;}) => (
    <motion.div variants={itemVariants} className="flex items-center justify-between pt-4 border-t">
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages} ({totalItems} itens)
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading} className="h-9">Anterior</Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages || isLoading} className="h-9">Próxima</Button>
      </div>
    </motion.div>
  );

// --- Helper: Grid Item ---
const GridItem = ({ emp, isAdmin }: { emp: ClientEmpreendimento; isAdmin: boolean }) => (
  <motion.div variants={itemVariants} layout>
    <Card className="overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md">
        <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block group">
            <div className="relative h-40 sm:h-48 w-full overflow-hidden bg-muted"><img src={emp.image || "/placeholder.svg?height=200&width=300"} alt={emp.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" onError={(e) => { e.currentTarget.src = "/placeholder.svg?height=200&width=300"; }}/>
                <div className="absolute top-2 right-2"><Badge className={cn("text-xs", getBadgeStyles(emp.status))}>{emp.status}</Badge></div>
            </div>
        </Link>
        <CardHeader className="pb-2 pt-3">
            <div className="flex justify-between items-start gap-2">
                <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block flex-1 min-w-0"><CardTitle className="text-base sm:text-lg font-semibold leading-tight hover:text-primary truncate" title={emp.name}>{emp.name}</CardTitle></Link>
                <DropdownMenu>
                    <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-[-2px]"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Ações</span></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Mais Ações</p></TooltipContent></Tooltip>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href={`/dashboard/despesas?empreendimento=${emp._id}`}>Ver Despesas</Link></DropdownMenuItem>
                        {isAdmin && (<><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/editar`}>Editar</Link></DropdownMenuItem></>)}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <CardDescription className="flex items-center text-xs text-muted-foreground pt-0.5 truncate" title={emp.address}><MapPin className="h-3 w-3 mr-1 flex-shrink-0" />{emp.address}</CardDescription>
        </CardHeader>
        <CardContent className="pb-3 flex-grow">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div><p className="text-muted-foreground">Tipo</p><p className="font-medium">{emp.type}</p></div>
                <div><p className="text-muted-foreground">Unidades</p><p className="font-medium">{emp.soldUnits}/{emp.totalUnits}</p></div>
                 <div><p className="text-muted-foreground">Despesas</p><p className={cn("font-medium flex items-center gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>{emp.pendingExpenses && emp.pendingExpenses > 0 ? (<><AlertTriangle className="h-3 w-3" />{emp.pendingExpenses} pend.</>) : (<><ThumbsUp className="h-3 w-3" />Em dia</>)}</p></div>
                 <div><p className="text-muted-foreground">Período</p><p className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(emp.startDate), "yy")}–{format(new Date(emp.endDate), "yy")}</p></div>
            </div>
        </CardContent>
        <CardFooter className="p-3"><Button variant="outline" size="sm" className="w-full text-xs h-8" asChild><Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link></Button></CardFooter>
    </Card>
  </motion.div>
);

// --- Helper: List Item ---
const ListItem = ({ emp, isAdmin }: { emp: ClientEmpreendimento; isAdmin: boolean }) => (
  <motion.div variants={itemVariants} layout>
    <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block group flex-shrink-0 w-full sm:w-40 md:w-48">
                <div className="relative aspect-[16/10] rounded-md overflow-hidden bg-muted"><img src={emp.image || "/placeholder.svg?height=120&width=200"} alt={emp.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" onError={(e) => { e.currentTarget.src = "/placeholder.svg?height=120&width=200"; }}/>
                    <div className="absolute top-1.5 right-1.5"><Badge className={cn("text-xs px-1.5 py-0.5", getBadgeStyles(emp.status))}>{emp.status}</Badge></div>
                </div>
            </Link>
            <div className="flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start gap-2 mb-0.5">
                        <Link href={`/dashboard/empreendimentos/${emp._id}`} className="flex-1 min-w-0"><h3 className="text-base sm:text-lg font-semibold leading-tight hover:text-primary line-clamp-1" title={emp.name}>{emp.name}</h3></Link>
                        <DropdownMenu>
                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-[-2px]"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Ações</span></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Mais Ações</p></TooltipContent></Tooltip>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/dashboard/despesas?empreendimento=${emp._id}`}>Ver Despesas</Link></DropdownMenuItem>
                                {isAdmin && (<><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/editar`}>Editar</Link></DropdownMenuItem></>)}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center line-clamp-1" title={emp.address}><MapPin className="h-3 w-3 mr-1 flex-shrink-0" />{emp.address}</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
                    <div><p className="text-muted-foreground">Tipo:</p><p className="font-medium">{emp.type}</p></div>
                    <div><p className="text-muted-foreground">Unidades:</p><p className="font-medium">{emp.soldUnits}/{emp.totalUnits}</p></div>
                    <div><p className="text-muted-foreground">Despesas:</p><p className={cn("font-medium flex items-center gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>{emp.pendingExpenses && emp.pendingExpenses > 0 ? (<><AlertTriangle className="h-3 w-3" />{emp.pendingExpenses} pend.</>) : (<><ThumbsUp className="h-3 w-3" />Em dia</>)}</p></div>
                    <div><p className="text-muted-foreground">Total Gasto:</p><p className="font-medium">R$ {(emp.totalExpenses ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p></div>
                </div>
            </div>
        </CardContent>
    </Card>
  </motion.div>
);

// --- Main Component ---
export default function EmpreendimentosList() {
  // *** FIX: Destructure status from useSession ***
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [empreendimentos, setEmpreendimentos] = useState<ClientEmpreendimento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEmpreendimentos, setTotalEmpreendimentos] = useState(0);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "todos");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "todos");
  const [viewMode, setViewMode] = useState(searchParams.get("view") || "grid");
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get("page") || "1", 10));

  // *** FIX: Use the correctly destructured 'status' variable ***
  const isAdmin = useMemo(() => status === 'authenticated' && session?.user?.role === "admin", [session, status]);
  const isManager = useMemo(() => status === 'authenticated' && session?.user?.role === "manager", [session, status]);

  const totalPages = useMemo(() => Math.ceil(totalEmpreendimentos / ITEMS_PER_PAGE), [totalEmpreendimentos]);

   // Client-side summary calculation
   const summaryCounts = useMemo(() => {
       return empreendimentos.reduce((acc, emp) => {
           acc.total++;
           if (emp.status === 'Em andamento') acc.inProgress++;
           else if (emp.status === 'Concluído') acc.completed++;
           else if (emp.status === 'Planejamento') acc.planning++;
           return acc;
       }, { total: 0, inProgress: 0, completed: 0, planning: 0 });
   }, [empreendimentos]);

  // Function to build URL parameters
  const buildUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (statusFilter !== "todos") params.set("status", statusFilter);
    if (typeFilter !== "todos") params.set("type", typeFilter);
    params.set("view", viewMode);
    params.set("page", String(currentPage));
    params.set("limit", String(ITEMS_PER_PAGE));
    return params.toString();
  }, [searchTerm, statusFilter, typeFilter, viewMode, currentPage]);

  // Effect to fetch data
  useEffect(() => {
    // *** FIX: Use the correctly destructured 'status' variable ***
    if (status === 'authenticated' && (isAdmin || isManager)) {
        let isMounted = true;
        const fetchEmpreendimentos = async () => {
          setIsLoading(true);
          const queryString = buildUrlParams();
          router.replace(`/dashboard/empreendimentos?${queryString}`, { scroll: false });
          try {
            const response = await fetch(`/api/empreendimentos?${queryString}`);
            if (!response.ok) throw new Error("Falha ao carregar");
            const data = await response.json();
            if (isMounted) {
              setEmpreendimentos(data.empreendimentos || []);
              setTotalEmpreendimentos(data.pagination?.total || 0);
              const newTotalPages = Math.ceil((data.pagination?.total || 0) / ITEMS_PER_PAGE);
              if (currentPage > newTotalPages && newTotalPages > 0) {
                  setCurrentPage(newTotalPages);
              } else if (newTotalPages === 0 && currentPage !== 1) {
                  setCurrentPage(1);
              }
            }
          } catch (error) { if (isMounted) { console.error("Erro:", error); toast({ variant: "destructive", title: "Erro", description: "Falha." }); setEmpreendimentos([]); setTotalEmpreendimentos(0); } }
          finally { if (isMounted) setIsLoading(false); }
        };
        fetchEmpreendimentos();
        return () => { isMounted = false; };
    } else if (status === 'unauthenticated') {
        setIsLoading(false); setEmpreendimentos([]); setTotalEmpreendimentos(0);
    }
    // If status is loading, isLoading remains true
  }, [searchTerm, statusFilter, typeFilter, viewMode, currentPage, router, toast, buildUrlParams, status, isAdmin, isManager]); // Included status in dependency array

  // Handlers
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => { setter(value); setCurrentPage(1); };
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(event.target.value); setCurrentPage(1); };
  const handleViewModeChange = (value: string) => { setViewMode(value); setCurrentPage(1); };

  // Loading State
  // *** FIX: Use the correctly destructured 'status' variable ***
  if (status === 'loading' || (isLoading && empreendimentos.length === 0)) {
       return ( /* Full page skeleton */
             <div className="space-y-6 px-4 sm:px-0">
               <div className="flex justify-between pb-4 border-b"><Skeleton className="h-8 w-40" /><Skeleton className="h-9 w-32" /></div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
               <div className="flex justify-between pb-4"><Skeleton className="h-9 w-full max-w-xs" /><div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /></div></div>
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={`skel-${index}`} />)}</div>
           </div>
       );
   }

   // RBAC check handled by page.tsx, assume component renders for Admin/Manager

  return (
    <TooltipProvider>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">Empreendimentos</h2><p className="text-muted-foreground text-sm">Gerencie seus projetos.</p></div>
          {isAdmin && (<Button size="sm" asChild className="h-9 w-full sm:w-auto text-sm"><Link href="/dashboard/empreendimentos/novo"><Plus className="mr-2 h-4 w-4" />Novo</Link></Button>)}
          {!isAdmin && isManager && (<div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-1.5 bg-muted/50"><Lock className="h-4 w-4" /><span>Somente Visualização</span></div>)}
        </div>

         {/* Summary Cards */}
         <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
             <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Total</CardTitle><Building className="h-4 w-4 text-muted-foreground" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.total}</div></CardContent>
             </Card>
             <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Em Andamento</CardTitle><Loader2 className="h-4 w-4 text-blue-500 animate-spin" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.inProgress}</div></CardContent>
             </Card>
             <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Concluídos</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.completed}</div></CardContent>
             </Card>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-sm font-medium">Planejamento</CardTitle><BarChart className="h-4 w-4 text-gray-500" /></CardHeader>
                <CardContent><div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-7 w-12"/> : summaryCounts.planning}</div></CardContent>
             </Card>
         </motion.div>

        {/* Filters and View Mode */}
        <motion.div variants={itemVariants} className="space-y-4">
           <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Buscar por nome..." className="pl-8 w-full text-sm h-9" value={searchTerm} onChange={handleSearchChange} disabled={isLoading}/></div>
           <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                 <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)} disabled={isLoading}><SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos Status</SelectItem><SelectItem value="Planejamento">Planejamento</SelectItem><SelectItem value="Em andamento">Em andamento</SelectItem><SelectItem value="Concluído">Concluído</SelectItem></SelectContent></Select>
                 <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)} disabled={isLoading}><SelectTrigger className="w-full sm:w-auto text-sm h-9 min-w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos Tipos</SelectItem><SelectItem value="Residencial">Residencial</SelectItem><SelectItem value="Comercial">Comercial</SelectItem><SelectItem value="Misto">Misto</SelectItem><SelectItem value="Industrial">Industrial</SelectItem></SelectContent></Select>
             </div>
             <Tabs value={viewMode} onValueChange={handleViewModeChange} className="w-full sm:w-auto"><TabsList className="grid grid-cols-2 w-full sm:w-auto h-9"><Tooltip><TooltipTrigger asChild><TabsTrigger value="grid" className="h-full px-3"><LayoutGrid className="h-4 w-4" /></TabsTrigger></TooltipTrigger><TooltipContent><p>Grade</p></TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><TabsTrigger value="list" className="h-full px-3"><List className="h-4 w-4" /></TabsTrigger></TooltipTrigger><TooltipContent><p>Lista</p></TooltipContent></Tooltip></TabsList></Tabs>
           </div>
        </motion.div>

        {/* Content Area */}
        <motion.div variants={itemVariants}>
          {isLoading && (viewMode === "grid" ?
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => <SkeletonCard key={`skel-g-${i}`} />)}</div>
              : <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonListItem key={`skel-l-${i}`} />)}</div>
          )}
          {!isLoading && viewMode === "grid" && (<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{empreendimentos.map(emp => <GridItem key={emp._id} emp={emp} isAdmin={isAdmin} />)}</div>)}
          {!isLoading && viewMode === "list" && (<div className="space-y-3">{empreendimentos.map(emp => <ListItem key={emp._id} emp={emp} isAdmin={isAdmin} />)}</div>)}
          {!isLoading && empreendimentos.length === 0 && (<EmptyState searchTerm={searchTerm} statusFilter={statusFilter} typeFilter={typeFilter} isAdmin={isAdmin} />)}
        </motion.div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (<PaginationControls currentPage={currentPage} totalPages={totalPages} totalItems={totalEmpreendimentos} onPageChange={setCurrentPage} isLoading={isLoading}/>)}
      </motion.div>
    </TooltipProvider>
  );
}