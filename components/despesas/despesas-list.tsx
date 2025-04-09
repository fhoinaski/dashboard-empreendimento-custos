// components/despesas/despesas-list.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// DataTableWithLoading is removed, using underlying components
import { PaginationControls } from '@/components/ui/pagination/pagination-controls';
import { FiltersCard } from '@/components/ui/filters/filters-card';
import { useDespesas } from '@/hooks/useDespesas';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDebounce } from '@/utils/debounce';
import { formatCurrency, formatDate } from '@/utils/format';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'; // Import table utilities
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Plus, Eye, Loader2, AlertTriangle, CheckCircle, Search, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';
import { ClientDespesa, DespesaFilterParams, DespesaStatus, DespesaApprovalStatus, DespesaCategory } from '@/lib/trpc/types';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Tipagem para as opções do select de empreendimentos
type EmpreendimentoOption = {
  _id: string;
  name: string;
};

// Skeleton Rows Component
const SkeletonTableRows = ({ columns, rowCount }: { columns: ColumnDef<ClientDespesa>[], rowCount: number }) => (
    // Use actual column count for better skeleton
    <TableBody>
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <TableRow key={`skel-row-${rowIndex}`}>
                {columns.map((column, colIndex) => (
                    <TableCell key={`skel-cell-${rowIndex}-${(column as any).id || colIndex}`}>
                        <Skeleton className="h-5 w-full" />
                    </TableCell>
                ))}
            </TableRow>
        ))}
    </TableBody>
);


// --- Componente Principal ---
export default function DespesasList() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();

  // Estado local para os filtros
  const [localFilters, setLocalFilters] = useState<Omit<DespesaFilterParams, 'sortBy' | 'sortOrder'>>({
    page: 1,
    limit: 15,
    status: undefined,
    search: undefined,
    empreendimento: undefined,
    approvalStatus: undefined,
    category: undefined,
  });

  const debouncedSearch = useDebounce(localFilters.search, 500);

  // Hook useDespesas
  const {
    despesas,
    pagination,
    isLoading,
    isFetching,
    updateFilters,
    approveDespesa,
    rejectDespesa,
    isApproving,
    isRejecting,
  } = useDespesas();

  // Hook useEmpreendimentos
  const { empreendimentos: empreendimentoOptions, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();

  // Handlers para filtros
  const handleLocalFilterChange = useCallback((key: keyof typeof localFilters, value: any) => {
    setLocalFilters(prev => {
      let finalValue = value;
      if (value === 'todos' || value === '') { finalValue = undefined; }
      if (key === 'status' && finalValue !== undefined) { finalValue = [finalValue as DespesaStatus]; } // Ensure status is array or undefined

      const newFilters = { ...prev, [key]: finalValue };
      if (key !== 'page') {
        newFilters.page = 1;
      }
      return newFilters;
    });
  }, []);

  // Efeito para atualizar filtros no hook
  useEffect(() => {
    updateFilters({
      ...localFilters,
      search: debouncedSearch,
    });
  }, [localFilters, debouncedSearch, updateFilters]);

  // Resetar filtros
  const handleResetFilters = useCallback(() => {
    setLocalFilters({
      page: 1,
      limit: 15,
      status: undefined,
      search: undefined,
      empreendimento: undefined,
      approvalStatus: undefined,
      category: undefined,
    });
  }, []);

  // Handlers para aprovar/rejeitar
  const handleApprove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try { await approveDespesa(id); } catch (error) { console.error("Approve failed:", error); }
  };
  const handleReject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try { await rejectDespesa(id, "Rejeitado via lista"); } catch (error) { console.error("Reject failed:", error); }
  };

  // --- Definição das Colunas Responsivas (Lógica de Ocultação dentro do cell/header) ---
  const columns = useMemo((): ColumnDef<ClientDespesa>[] => [
    {
      accessorKey: 'description',
      header: 'Descrição',
      cell: ({ row }) => (
        <div>
          {/* Desktop View */}
          <span className="font-medium truncate block max-w-[200px] md:max-w-xs" title={row.original.description}>
            {row.original.description}
          </span>
          {/* Mobile View (Combined Info) - Rendered inside the same cell, hidden on larger screens */}
          <div className="sm:hidden text-xs">
            {/*<p className="font-medium mb-0.5">{row.original.description}</p>*/} {/* Description is already above */}
            <p className="text-muted-foreground">
              {formatCurrency(row.original.value)} • Vence: {formatDate(row.original.dueDate)}
            </p>
            <p className="text-muted-foreground">
              Empr: <span className="truncate" title={row.original.empreendimento?.name ?? 'N/A'}>{row.original.empreendimento?.name ?? 'N/A'}</span>
            </p>
             <div className="flex gap-1 mt-1"> {/* Reduced gap */}
                 <Badge variant={row.original.status === 'Pago' ? 'default' : 'secondary'} className={cn("text-[9px] px-1 py-0", row.original.status === 'Pago' && 'bg-green-100 text-green-800 border-green-300')}>
                    {row.original.status}
                 </Badge>
                 <Badge variant={row.original.approvalStatus === 'Aprovado' ? 'default' : 'secondary'} className={cn("text-[9px] px-1 py-0", row.original.approvalStatus === 'Aprovado' && 'bg-green-100 text-green-800 border-green-300', row.original.approvalStatus === 'Rejeitado' && 'bg-red-100 text-red-800 border-red-300')}>
                    {row.original.approvalStatus}
                 </Badge>
             </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'value',
      header: () => <div className="text-right hidden sm:table-cell">Valor</div>,
      cell: ({ row }) => <div className="text-right whitespace-nowrap hidden sm:table-cell">{formatCurrency(row.original.value)}</div>,
    },
    {
      accessorFn: (row) => row.empreendimento?.name ?? 'N/A',
      id: 'empreendimentoName',
      header: () => <div className="hidden md:table-cell">Empreendimento</div>,
      cell: ({ row }) => (<span className="truncate max-w-[150px] hidden md:block" title={row.original.empreendimento?.name ?? 'N/A'}> {row.original.empreendimento?.name ?? 'N/A'} </span>),
    },
    {
      accessorKey: 'dueDate',
      header: () => <div className="hidden sm:table-cell">Vencimento</div>,
      cell: ({ row }) => (<span className="truncate max-w-[150px] hidden md:block" title={row.original.empreendimento?.name ?? 'N/A'}> {row.original.empreendimento?.name ?? 'N/A'} </span>),

    },
    {
      accessorKey: 'status',
      header: () => <div className="text-center hidden md:table-cell">Status Pag.</div>,
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        let bgColor = 'bg-gray-100 dark:bg-gray-800'; let textColor = 'text-gray-800 dark:text-gray-300'; let borderColor = 'border-gray-300 dark:border-gray-600';
        if (status === 'Pago') { variant = 'default'; bgColor = 'bg-green-100 dark:bg-green-900/30'; textColor = 'text-green-800 dark:text-green-300'; borderColor = 'border-green-300 dark:border-green-700'; }
        else if (status === 'A vencer') { variant = 'secondary'; bgColor = 'bg-amber-100 dark:bg-amber-900/30'; textColor = 'text-amber-800 dark:text-amber-300'; borderColor = 'border-amber-300 dark:border-amber-700'; }
        else if (status === 'Pendente' || status === 'Rejeitado') { variant = 'destructive'; bgColor = 'bg-red-100 dark:bg-red-900/30'; textColor = 'text-red-800 dark:text-red-300'; borderColor = 'border-red-300 dark:border-red-700'; }
        // Apply responsive class to the wrapper div
        return <div className="text-center hidden md:table-cell"><Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge></div>;
      }
    },
    {
      accessorKey: 'approvalStatus',
      header: () => <div className="text-center hidden lg:table-cell">Aprovação</div>,
      cell: ({ row }) => {
        const status = row.original.approvalStatus;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        let bgColor = 'bg-gray-100 dark:bg-gray-800'; let textColor = 'text-gray-800 dark:text-gray-300'; let borderColor = 'border-gray-300 dark:border-gray-600';
        if (status === 'Aprovado') { variant = 'default'; bgColor = 'bg-green-100 dark:bg-green-900/30'; textColor = 'text-green-800 dark:text-green-300'; borderColor = 'border-green-300 dark:border-green-700'; }
        else if (status === 'Pendente') { variant = 'secondary'; bgColor = 'bg-amber-100 dark:bg-amber-900/30'; textColor = 'text-amber-800 dark:text-amber-300'; borderColor = 'border-amber-300 dark:border-amber-700'; }
        else if (status === 'Rejeitado') { variant = 'destructive'; bgColor = 'bg-red-100 dark:bg-red-900/30'; textColor = 'text-red-800 dark:text-red-300'; borderColor = 'border-red-300 dark:border-red-700'; }
        // Apply responsive class to the wrapper div
        return <div className="text-center hidden lg:table-cell"><Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge></div>;
      }
    },
    {
      id: 'actions',
      header: () => <div className="text-right pr-2 sm:pr-4">Ações</div>, // Adjust padding if needed
      cell: ({ row }) => {
        const despesa = row.original;
        const isProcessingReview = (typeof isApproving === 'string' && isApproving === despesa._id) || (typeof isRejecting === 'string' && isRejecting === despesa._id);
        const canReview = session?.user?.role === 'admin';

        return (
          <div className="flex justify-end items-center gap-0.5">
            {canReview && despesa.approvalStatus === 'Pendente' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={(e) => handleApprove(e, despesa._id)} disabled={!!isProcessingReview} aria-label={`Aprovar ${despesa.description}`}>
                      {typeof isApproving === 'string' && isApproving === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> <p>Aprovar</p> </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100" onClick={(e) => handleReject(e, despesa._id)} disabled={!!isProcessingReview} aria-label={`Rejeitar ${despesa.description}`}>
                      {typeof isRejecting === 'string' && isRejecting === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent> <p>Rejeitar</p> </TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                 {/* Use Link directly inside Button for navigation */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild // Make Button act as the Link
                  aria-label={`Ver detalhes de ${despesa.description}`}
                >
                   <Link href={`/dashboard/despesas/${despesa._id}`} onClick={(e) => e.stopPropagation()}> {/* Prevent row click */}
                     <Eye className="h-4 w-4" />
                   </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent> <p>Ver Detalhes</p> </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [session?.user?.role, isApproving, isRejecting, router, handleApprove, handleReject]); // Dependencies for columns memo


  // --- tanstack-table instance ---
  const table = useReactTable({
    data: despesas as ClientDespesa[] ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Manual pagination since data comes from the hook
    manualPagination: true,
    pageCount: pagination?.pages ?? -1, // Use total pages from hook, -1 if unknown
  });

  // --- Renderização ---
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Despesas</h1>
          <Button size="sm" asChild className="w-full md:w-auto">
            <Link href="/dashboard/despesas/novo">
              <Plus className="mr-2 h-4 w-4" />
              Nova Despesa
            </Link>
          </Button>
        </motion.div>

        {/* Filtros */}
        <FiltersCard title="Filtrar Despesas" onReset={handleResetFilters} isLoading={isLoading || isFetching}>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Buscar descrição..."
              value={localFilters.search ?? ''}
              onChange={(e) => handleLocalFilterChange('search', e.target.value)}
              disabled={isLoading || isFetching}
              className="h-9 text-sm lg:col-span-2"
              aria-label="Buscar por descrição"
            />
            <Select
              value={localFilters.empreendimento ?? 'todos'}
              onValueChange={(value) => handleLocalFilterChange('empreendimento', value)}
              disabled={isLoadingEmpreendimentos || isLoading || isFetching}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Empreendimentos</SelectItem>
                {(empreendimentoOptions || []).map((emp: EmpreendimentoOption) => (
                  <SelectItem key={emp._id} value={emp._id}> {emp.name} </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={localFilters.status?.[0] ?? 'todos'}
              onValueChange={(value) => handleLocalFilterChange('status', value)}
              disabled={isLoading || isFetching}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status Pag." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status Pag.</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="A vencer">A vencer</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado (Pag.)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={localFilters.approvalStatus ?? 'todos'}
              onValueChange={(value) => handleLocalFilterChange('approvalStatus', value)}
              disabled={isLoading || isFetching}
            >
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status Aprov." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status Aprov.</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FiltersCard>

        {/* Tabela */}
         <div className="rounded-md border">
             <div className="overflow-x-auto"> {/* <<< Horizontal Scroll Wrapper >>> */}
                 <Table>
                     <TableHeader>
                         {table.getHeaderGroups().map((headerGroup) => (
                             <TableRow key={headerGroup.id}>
                                 {headerGroup.headers.map((header) => (
                                     <TableHead key={header.id} className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm"> {/* Adjust padding/size */}
                                         {header.isPlaceholder ? null : flexRender( header.column.columnDef.header, header.getContext() )}
                                     </TableHead>
                                 ))}
                             </TableRow>
                         ))}
                     </TableHeader>
                     {/* Use Skeleton Component */}
                     {isLoading || (isFetching && (!despesas || despesas.length === 0)) ? (
                         <SkeletonTableRows columns={columns} rowCount={localFilters.limit ?? 15} />
                     ) : (
                         <TableBody>
                             {table.getRowModel().rows?.length ? (
                                 table.getRowModel().rows.map((row) => (
                                     <TableRow
                                         key={row.id}
                                         data-state={false /* Add selection logic if needed */}
                                         className="hover:bg-muted/50 cursor-pointer"
                                         onClick={() => router.push(`/dashboard/despesas/${row.original._id}`)}
                                     >
                                         {row.getVisibleCells().map((cell) => (
                                             <TableCell key={cell.id} className="px-3 py-2 align-top text-xs sm:text-sm"> {/* Adjust padding/size */}
                                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                             </TableCell>
                                         ))}
                                     </TableRow>
                                 ))
                             ) : (
                                 <TableRow>
                                     <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                         Nenhuma despesa encontrada {localFilters.search ? `para "${localFilters.search}"` : ''}.
                                     </TableCell>
                                 </TableRow>
                             )}
                         </TableBody>
                     )}
                 </Table>
             </div>
         </div>


        {/* Paginação */}
        {pagination && pagination.pages > 1 && !isLoading && (
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={(page) => handleLocalFilterChange('page', page)}
            isDisabled={isFetching} // Disable only while actively fetching new data
          />
        )}
      </div>
    </TooltipProvider>
  );
}