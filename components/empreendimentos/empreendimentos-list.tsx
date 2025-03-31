"use client";

import { useState, useEffect, useMemo } from "react"; // Added useMemo
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // Added useRouter, useSearchParams
import { Building, Plus, Search, MoreHorizontal, MapPin, Calendar, ThumbsUp, AlertTriangle, Loader2, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip
import { useToast } from "@/components/ui/use-toast";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// DEFINA ESTA INTERFACE EM UM ARQUIVO COMPARTILHADO (ex: types/index.ts) E IMPORTE AQUI
interface ClientEmpreendimento {
    _id: string;
    name: string;
    address: string;
    type: string;
    status: string;
    totalUnits: number;
    soldUnits: number;
    startDate: string; // ISO string
    endDate: string; // ISO string
    description?: string;
    responsiblePerson: string;
    contactEmail: string;
    contactPhone: string;
    image?: string;
    folderId?: string;
    sheetId?: string;
    pendingExpenses?: number; // Added by API/Server Component
    totalExpenses?: number; // Added by API/Server Component
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

const ITEMS_PER_PAGE = 9; // Items per page for grid view

export default function EmpreendimentosList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [empreendimentos, setEmpreendimentos] = useState<ClientEmpreendimento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEmpreendimentos, setTotalEmpreendimentos] = useState(0);

  // Filters and View Mode - Initialize from URL
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || "todos");
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || "todos");
  const [viewMode, setViewMode] = useState(searchParams.get('view') || "grid"); // Default to grid
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Fetch Empreendimentos based on filters and pagination
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.set('q', searchTerm); // Assuming API supports search via 'q'
      if (statusFilter !== 'todos') params.set('status', statusFilter);
      if (typeFilter !== 'todos') params.set('type', typeFilter);
      params.set('view', viewMode); // Persist view mode in URL
      params.set('page', String(currentPage));
      params.set('limit', String(ITEMS_PER_PAGE));
      // params.set('skip', String((currentPage - 1) * ITEMS_PER_PAGE)); // Skip is handled by page/limit in API usually

      // Update URL
       router.replace(`/dashboard/empreendimentos?${params.toString()}`, { scroll: false });

      try {
        const response = await fetch(`/api/empreendimentos?${params.toString()}`);
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
        const data = await response.json();
        if (isMounted) {
          setEmpreendimentos(data.empreendimentos || []);
          setTotalEmpreendimentos(data.pagination?.total || 0);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar empreendimentos:", error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os empreendimentos." });
          setEmpreendimentos([]);
          setTotalEmpreendimentos(0);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, [searchTerm, statusFilter, typeFilter, viewMode, currentPage, router, toast]);

  // --- Filter Handlers ---
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setCurrentPage(1); // Reset page on filter change
  };

   const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
      setCurrentPage(1);
  };

  const handleViewModeChange = (value: string) => {
      setViewMode(value);
      // Optionally reset page, or keep current page? Resetting is safer.
      setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalEmpreendimentos / ITEMS_PER_PAGE);

  // --- Animation Variants ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 }}};
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 }};

  return (
    <TooltipProvider>
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6 px-4 sm:px-0" // Use parent padding
        >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
            <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Empreendimentos</h2>
            <p className="text-muted-foreground text-sm">Gerencie e visualize seus projetos imobiliários.</p>
            </div>
            <Button size="sm" asChild className="h-9 w-full sm:w-auto text-sm">
            <Link href="/dashboard/empreendimentos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo Empreendimento
            </Link>
            </Button>
        </div>

        {/* Filters and View Mode */}
        <motion.div variants={itemVariants} className="space-y-4">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por nome ou endereço..."
                    className="pl-8 w-full text-sm h-9"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    disabled={isLoading}
                />
            </div>
            {/* Filter Selects and View Toggle */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)} disabled={isLoading}>
                        <SelectTrigger className="w-full sm:w-auto text-sm h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos Status</SelectItem>
                            <SelectItem value="Planejamento">Planejamento</SelectItem>
                            <SelectItem value="Em andamento">Em andamento</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)} disabled={isLoading}>
                        <SelectTrigger className="w-full sm:w-auto text-sm h-9">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos Tipos</SelectItem>
                            <SelectItem value="Residencial">Residencial</SelectItem>
                            <SelectItem value="Comercial">Comercial</SelectItem>
                            <SelectItem value="Misto">Misto</SelectItem>
                            <SelectItem value="Industrial">Industrial</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 {/* View Mode Toggle */}
                 <Tabs value={viewMode} onValueChange={handleViewModeChange} className="w-full sm:w-auto">
                    <TabsList className="grid grid-cols-2 w-full sm:w-auto h-9">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <TabsTrigger value="grid" className="h-full px-3"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Visualizar em Grade</p></TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <TabsTrigger value="list" className="h-full px-3"><List className="h-4 w-4" /></TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Visualizar em Lista</p></TooltipContent>
                        </Tooltip>
                    </TabsList>
                 </Tabs>
            </div>
        </motion.div>

        {/* Content Area (Grid or List) */}
        <motion.div variants={itemVariants}>
            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {isLoading && Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                        <Card key={`skel-grid-${index}`} className="overflow-hidden flex flex-col">
                            <Skeleton className="h-48 w-full" />
                            <CardHeader className="pb-2"><Skeleton className="h-5 w-3/4 mb-1" /><Skeleton className="h-3 w-full" /></CardHeader>
                            <CardContent className="pb-2 flex-grow space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/3" /></CardContent>
                            <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
                        </Card>
                    ))}
                    {!isLoading && empreendimentos.map((emp) => (
                        <motion.div key={emp._id} variants={itemVariants} layout>
                            <Card className="overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md">
                                <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block group">
                                    <div className="relative h-40 sm:h-48 w-full overflow-hidden">
                                        <img
                                            src={emp.image || "/placeholder.svg?height=200&width=300"}
                                            alt={emp.name}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            loading="lazy" // Lazy load images
                                        />
                                        <div className="absolute top-2 right-2">
                                            <Badge
                                            variant={emp.status === "Concluído" ? "outline" : emp.status === "Planejamento" ? "secondary" : "default"}
                                            className={cn("text-xs",
                                                emp.status === "Concluído" && "bg-green-100 text-green-800 border-green-300",
                                                emp.status === "Em andamento" && "bg-blue-100 text-blue-800 border-blue-300",
                                                emp.status === "Planejamento" && "bg-gray-100 text-gray-800 border-gray-300"
                                            )}
                                            >
                                            {emp.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </Link>
                                <CardHeader className="pb-2 pt-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block">
                                            <CardTitle className="text-base sm:text-lg font-semibold leading-tight hover:text-primary truncate" title={emp.name}>
                                                {emp.name}
                                            </CardTitle>
                                        </Link>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-[-2px]">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Ações</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link></DropdownMenuItem>
                                                <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/editar`}>Editar</Link></DropdownMenuItem>
                                                <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/despesas`}>Ver Despesas</Link></DropdownMenuItem>
                                                {/* Add delete option with confirmation */}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <CardDescription className="flex items-center text-xs text-muted-foreground pt-0.5 truncate" title={emp.address}>
                                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                        {emp.address}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pb-3 flex-grow">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Tipo</p>
                                            <p className="font-medium">{emp.type}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Unidades</p>
                                            <p className="font-medium">{emp.soldUnits}/{emp.totalUnits}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Despesas</p>
                                            <p className={cn("font-medium flex items-center gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>
                                                {emp.pendingExpenses && emp.pendingExpenses > 0
                                                    ? <><AlertTriangle className="h-3 w-3" />{emp.pendingExpenses} pendente(s)</>
                                                    : <><ThumbsUp className="h-3 w-3" />Em dia</>}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Período</p>
                                            <p className="font-medium flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(emp.startDate), "yyyy")}–{format(new Date(emp.endDate), "yyyy")}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3">
                                    <Button variant="outline" size="sm" className="w-full text-xs h-8" asChild>
                                        <Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

             {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-3">
                     {isLoading && Array.from({ length: 5 }).map((_, index) => (
                         <Card key={`skel-list-${index}`}>
                             <CardContent className="p-4 flex gap-4">
                                <Skeleton className="h-24 w-32 rounded-md flex-shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-3 w-full" />
                                    <div className="grid grid-cols-4 gap-4 pt-2">
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-full" />
                                    </div>
                                </div>
                             </CardContent>
                         </Card>
                     ))}
                     {!isLoading && empreendimentos.map((emp) => (
                         <motion.div key={emp._id} variants={itemVariants} layout>
                             <Card className="transition-shadow hover:shadow-md">
                                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    <Link href={`/dashboard/empreendimentos/${emp._id}`} className="block group flex-shrink-0 w-full sm:w-40 md:w-48">
                                        <div className="relative aspect-[16/10] rounded-md overflow-hidden">
                                             <img
                                                src={emp.image || "/placeholder.svg?height=120&width=200"}
                                                alt={emp.name}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                loading="lazy"
                                            />
                                             <div className="absolute top-1.5 right-1.5">
                                                <Badge
                                                    variant={emp.status === "Concluído" ? "outline" : emp.status === "Planejamento" ? "secondary" : "default"}
                                                    className={cn("text-xs px-1.5 py-0.5", // Smaller badge
                                                        emp.status === "Concluído" && "bg-green-100 text-green-800 border-green-300",
                                                        emp.status === "Em andamento" && "bg-blue-100 text-blue-800 border-blue-300",
                                                        emp.status === "Planejamento" && "bg-gray-100 text-gray-800 border-gray-300"
                                                    )}
                                                    >
                                                    {emp.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start gap-2 mb-0.5">
                                                <Link href={`/dashboard/empreendimentos/${emp._id}`}>
                                                    <h3 className="text-base sm:text-lg font-semibold leading-tight hover:text-primary line-clamp-1" title={emp.name}>{emp.name}</h3>
                                                </Link>
                                                <DropdownMenu>
                                                    {/* Same Dropdown as Grid View */}
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 mt-[-2px]">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Ações</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}`}>Ver Detalhes</Link></DropdownMenuItem>
                                                        <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/editar`}>Editar</Link></DropdownMenuItem>
                                                        <DropdownMenuItem asChild><Link href={`/dashboard/empreendimentos/${emp._id}/despesas`}>Ver Despesas</Link></DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center line-clamp-1" title={emp.address}>
                                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                                {emp.address}
                                            </p>
                                        </div>
                                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
                                            <div><p className="text-muted-foreground">Tipo:</p> <p className="font-medium">{emp.type}</p></div>
                                            <div><p className="text-muted-foreground">Unidades:</p> <p className="font-medium">{emp.soldUnits}/{emp.totalUnits}</p></div>
                                            <div>
                                                <p className="text-muted-foreground">Despesas:</p>
                                                <p className={cn("font-medium flex items-center gap-1", emp.pendingExpenses && emp.pendingExpenses > 0 ? "text-amber-600" : "text-green-600")}>
                                                {emp.pendingExpenses && emp.pendingExpenses > 0
                                                    ? <><AlertTriangle className="h-3 w-3" />{emp.pendingExpenses} pend.</>
                                                    : <><ThumbsUp className="h-3 w-3" />Em dia</>}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Total Gasto:</p>
                                                <p className="font-medium">R$ {(emp.totalExpenses ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                             </Card>
                         </motion.div>
                     ))}
                 </div>
            )}

             {/* Empty State */}
             {!isLoading && empreendimentos.length === 0 && (
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col items-center justify-center py-16 text-center px-4"
                >
                    <Building className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Nenhum empreendimento encontrado</h3>
                    <p className="text-muted-foreground mt-1 text-sm max-w-sm">
                        {searchTerm || statusFilter !== 'todos' || typeFilter !== 'todos'
                            ? "Tente ajustar os filtros de busca para encontrar o que procura."
                            : "Você ainda não cadastrou nenhum empreendimento. Comece agora!"}
                    </p>
                    <Button size="sm" className="mt-6" asChild>
                        <Link href="/dashboard/empreendimentos/novo">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Empreendimento
                        </Link>
                    </Button>
                </motion.div>
            )}
        </motion.div>

         {/* Pagination Controls */}
           {!isLoading && totalPages > 1 && (
             <motion.div variants={itemVariants} className="flex items-center justify-between pt-4 border-t">
               <span className="text-sm text-muted-foreground">
                 Página {currentPage} de {totalPages} ({totalEmpreendimentos} itens)
               </span>
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                   disabled={currentPage === 1 || isLoading}
                   className="h-9"
                 >
                   Anterior
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                   disabled={currentPage === totalPages || isLoading}
                   className="h-9"
                 >
                   Próxima
                 </Button>
               </div>
             </motion.div>
           )}

        </motion.div>
    </TooltipProvider>
  );
}