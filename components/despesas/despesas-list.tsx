// components/despesas/despesas-list.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTableWithLoading } from '@/components/ui/data-table/data-table-with-loading';
import { PaginationControls } from '@/components/ui/pagination/pagination-controls';
import { FiltersCard } from '@/components/ui/filters/filters-card';
import { useDespesas } from '@/hooks/useDespesas';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDebounce } from '@/utils/debounce';
import { formatCurrency, formatDate } from '@/utils/format';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Plus, Eye, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';
// Import ClientDespesa and DespesaFilterParams types from shared location
import { ClientDespesa, DespesaFilterParams } from '@/lib/trpc/types';
import Link from 'next/link';


// Tipagem para as opções do select de empreendimentos
type EmpreendimentoOption = {
  _id: string;
  name: string;
};

// --- Componente Principal ---
export default function DespesasList() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();

  // Estado local para os filtros, inicializado com a página 1
  const [localFilters, setLocalFilters] = useState<Omit<DespesaFilterParams, 'sortBy' | 'sortOrder'>>({
    page: 1,
    limit: 15, // Mantendo o limite original do componente
    status: undefined,
    search: undefined,
    empreendimento: undefined,
    approvalStatus: undefined,
    category: undefined
  });

  const debouncedSearch = useDebounce(localFilters.search, 500);

  // Usar o hook useDespesas e destructure pagination corretamente
  const {
    despesas,
    pagination, // <-- Destructure pagination object
    isLoading,
    isFetching,
    updateFilters,
    approveDespesa,
    rejectDespesa,
    isApproving,
    isRejecting
  } = useDespesas();

  // Use empreendimento hook
  const { empreendimentos: empreendimentoOptions, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();

  // Handler para mudanças nos filtros locais
  const handleLocalFilterChange = useCallback((key: keyof typeof localFilters, value: any) => {
    setLocalFilters(prev => {
      let finalValue = value;
      if (value === 'todos' || value === '') { finalValue = undefined; }
      if (key === 'status') { finalValue = (value === 'todos' || value === '') ? undefined : [value]; }
      const newFilters = { ...prev, [key]: finalValue };
      if (key !== 'page') newFilters.page = 1;
      return newFilters;
    });
  }, []);


  // Efeito para chamar updateFilters (do hook) quando localFilters ou debouncedSearch mudam
  useEffect(() => {
    updateFilters({
      ...localFilters,
      search: debouncedSearch
    });
  }, [localFilters, debouncedSearch, updateFilters]);

  // Handler para resetar filtros locais
  const handleResetFilters = useCallback(() => {
    setLocalFilters({ page: 1, limit: 15, status: undefined, search: undefined, empreendimento: undefined, approvalStatus: undefined, category: undefined });
  }, []);

  // Handlers para aprovar/rejeitar
  const handleApprove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); try { await approveDespesa(id); } catch (error) { console.error("Approve failed:", error); }
  };
  const handleReject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); try { await rejectDespesa(id, "Rejeitado via lista"); } catch (error) { console.error("Reject failed:", error); }
  };

  // Definição das colunas da tabela (Use imported ClientDespesa type)
  const columns = useMemo((): ColumnDef<ClientDespesa>[] => [
    // ... (other column definitions remain the same) ...
    { accessorKey: 'description', header: 'Descrição', cell: ({ row }) => (<span className="font-medium truncate block max-w-[200px] md:max-w-xs" title={row.original.description}> {row.original.description} </span>) },
    { accessorKey: 'value', header: () => <div className="text-right">Valor</div>, cell: ({ row }) => <div className="text-right whitespace-nowrap">{formatCurrency(row.original.value)}</div> },
    { accessorFn: (row) => row.empreendimento?.name ?? 'N/A', id: 'empreendimentoName', header: 'Empreendimento', cell: ({ row }) => (<span className="truncate block max-w-[150px]" title={row.original.empreendimento?.name ?? 'N/A'}> {row.original.empreendimento?.name ?? 'N/A'} </span>) },
    { accessorKey: 'dueDate', header: 'Vencimento', cell: ({ row }) => formatDate(row.original.dueDate) },
    { accessorKey: 'status', header: 'Status Pag.', cell: ({ row }) => { const status = row.original.status; let variant: "default" | "secondary" | "destructive" | "outline" = "outline"; let bgColor = 'bg-gray-100 dark:bg-gray-800'; let textColor = 'text-gray-800 dark:text-gray-300'; let borderColor = 'border-gray-300 dark:border-gray-600'; if (status === 'Pago') { variant = 'default'; bgColor = 'bg-green-100 dark:bg-green-900/30'; textColor = 'text-green-800 dark:text-green-300'; borderColor = 'border-green-300 dark:border-green-700'; } else if (status === 'A vencer') { variant = 'secondary'; bgColor = 'bg-amber-100 dark:bg-amber-900/30'; textColor = 'text-amber-800 dark:text-amber-300'; borderColor = 'border-amber-300 dark:border-amber-700'; } else if (status === 'Pendente' || status === 'Rejeitado') { variant = 'destructive'; bgColor = 'bg-red-100 dark:bg-red-900/30'; textColor = 'text-red-800 dark:text-red-300'; borderColor = 'border-red-300 dark:border-red-700'; } return <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge>; } },
    { accessorKey: 'approvalStatus', header: 'Aprovação', cell: ({ row }) => { const status = row.original.approvalStatus; let variant: "default" | "secondary" | "destructive" | "outline" = "outline"; let bgColor = 'bg-gray-100 dark:bg-gray-800'; let textColor = 'text-gray-800 dark:text-gray-300'; let borderColor = 'border-gray-300 dark:border-gray-600'; if (status === 'Aprovado') { variant = 'default'; bgColor = 'bg-green-100 dark:bg-green-900/30'; textColor = 'text-green-800 dark:text-green-300'; borderColor = 'border-green-300 dark:border-green-700'; } else if (status === 'Pendente') { variant = 'secondary'; bgColor = 'bg-amber-100 dark:bg-amber-900/30'; textColor = 'text-amber-800 dark:text-amber-300'; borderColor = 'border-amber-300 dark:border-amber-700'; } else if (status === 'Rejeitado') { variant = 'destructive'; bgColor = 'bg-red-100 dark:bg-red-900/30'; textColor = 'text-red-800 dark:text-red-300'; borderColor = 'border-red-300 dark:border-red-700'; } return <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge>; } },

    {
      id: 'actions',
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => {
        const despesa = row.original;
        const isProcessingReview = (typeof isApproving === 'string' && isApproving === despesa._id) || (typeof isRejecting === 'string' && isRejecting === despesa._id);
        const canReview = session?.user?.role === 'admin';

        return (
          <div className="flex justify-end items-center gap-0.5 sm:gap-1">
            {/* *** FIX: Render buttons individually if condition met, remove fragment *** */}
            {canReview && despesa.approvalStatus === 'Pendente' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600 hover:bg-green-100"
                    onClick={(e) => handleApprove(e, despesa._id)}
                    disabled={!!isProcessingReview}
                    aria-label={`Aprovar ${despesa.description}`}
                  >
                    {typeof isApproving === 'string' && isApproving === despesa._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent> <p>Aprovar Despesa</p> </TooltipContent>
              </Tooltip>
            )}
            {canReview && despesa.approvalStatus === 'Pendente' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-600 hover:bg-red-100"
                    onClick={(e) => handleReject(e, despesa._id)}
                    disabled={!!isProcessingReview}
                    aria-label={`Rejeitar ${despesa.description}`}
                  >
                    {typeof isRejecting === 'string' && isRejecting === despesa._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent> <p>Rejeitar Despesa</p> </TooltipContent>
              </Tooltip>
            )}
            {/* *** END FIX *** */}

            {/* Botão Ver Detalhes (remains the same) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => router.push(`/dashboard/despesas/${despesa._id}`)}
                  aria-label={`Ver detalhes de ${despesa.description}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent> <p>Ver Detalhes</p> </TooltipContent>
            </Tooltip>
          </div>
        );
      }
    }
  ], [session?.user?.role, isApproving, isRejecting, router, handleApprove, handleReject]);

  // --- Renderização ---
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <motion.div /* ... */ >
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Despesas</h1>
          <Button size="sm" asChild className="w-full md:w-auto">
            <Link href="/dashboard/despesas/novo"> {/* <-- O link está aqui */}
              <Plus className="mr-2 h-4 w-4" />
              Nova Despesa
            </Link>
          </Button>
        </motion.div>

        {/* Filtros */}
        <FiltersCard /* ... */ >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4"> {/* Adjusted grid */}
            {/* ... Filter Inputs ... */}
            <Input placeholder="Buscar descrição..." value={localFilters.search ?? ''} onChange={(e) => handleLocalFilterChange('search', e.target.value)} disabled={isLoading || isFetching} className="h-9 text-sm" aria-label="Buscar por descrição" />
            <Select value={localFilters.empreendimento ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('empreendimento', value)} disabled={isLoadingEmpreendimentos || isLoading || isFetching}> <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Empreendimento" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todos Empreendimentos</SelectItem> {(empreendimentoOptions || []).map((emp: EmpreendimentoOption) => (<SelectItem key={emp._id} value={emp._id}> {emp.name} </SelectItem>))} </SelectContent> </Select>
            <Select value={localFilters.status?.[0] ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('status', value)} disabled={isLoading || isFetching}> <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status Pagamento" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todos</SelectItem> <SelectItem value="Pago">Pago</SelectItem> <SelectItem value="Pendente">Pendente</SelectItem> <SelectItem value="A vencer">A vencer</SelectItem> <SelectItem value="Rejeitado">Rejeitado</SelectItem> </SelectContent> </Select>
            <Select value={localFilters.approvalStatus ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('approvalStatus', value)} disabled={isLoading || isFetching}> <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status Aprovação" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todos</SelectItem> <SelectItem value="Pendente">Pendente</SelectItem> <SelectItem value="Aprovado">Aprovado</SelectItem> <SelectItem value="Rejeitado">Rejeitado</SelectItem> </SelectContent> </Select>
            <Select value={localFilters.category ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('category', value)} disabled={isLoading || isFetching}> <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger> <SelectContent> <SelectItem value="todos">Todas</SelectItem> <SelectItem value="Material">Material</SelectItem> <SelectItem value="Serviço">Serviço</SelectItem> <SelectItem value="Equipamento">Equipamento</SelectItem> <SelectItem value="Taxas">Taxas</SelectItem> <SelectItem value="Outros">Outros</SelectItem> </SelectContent> </Select>
          </div>
        </FiltersCard>

        {/* Tabela */}
        <DataTableWithLoading
          columns={columns}
          data={despesas as ClientDespesa[] ?? []}
          isLoading={isLoading}
          skeletonRows={localFilters.limit}
        />

        {/* Paginação */}
        {pagination && pagination.pages > 1 && (
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={(page) => handleLocalFilterChange('page', page)}
            isDisabled={isLoading || isFetching}
          />
        )}
      </div>
    </TooltipProvider>
  );
}