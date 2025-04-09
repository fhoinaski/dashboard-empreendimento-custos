
import { trpc } from '@/lib/trpc/client';
import { useCallback, useState, useEffect } from 'react';

import { DespesaFilterParams, CreateDespesaInput, UpdateDespesaFormInput, PaginationInfo } from '@/lib/trpc/types';

import { useToast } from '@/components/ui/use-toast';
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '@/server/api/root';
import { skipToken } from '@tanstack/react-query';

export function useDespesas() {
  const { toast } = useToast();
  const utils = trpc.useContext();

  const [filters, setFilters] = useState<DespesaFilterParams>({
    page: 1, limit: 10, // Defaulting to 10
    status: undefined, approvalStatus: undefined, category: undefined, empreendimento: undefined, startDate: undefined, endDate: undefined, search: undefined, sortBy: undefined, sortOrder: undefined,
  });

  // Query for listing despesas
  const despesasQuery = trpc.despesas.getAll.useQuery( filters, { placeholderData: (previousData) => previousData, staleTime: 1000 * 60 * 1, } );

  useEffect(() => {
    if (despesasQuery.error) { console.error("Erro ao buscar despesas:", despesasQuery.error); toast({ title: "Erro", description: "Não foi possível carregar a lista de despesas.", variant: "destructive", }); }
  }, [despesasQuery.error, toast]);

  // Function to get a single despesa by ID
  const getDespesaById = (id: string | undefined | null) => {
    const isIdProvided = id && typeof id === 'string' && id.trim() !== '';
    const queryInput = isIdProvided ? { id } : skipToken;
    return trpc.despesas.getById.useQuery(
      queryInput,
      { staleTime: 1000 * 60 * 5, enabled: !!isIdProvided, retry: (failureCount, error) => { const trpcError = error as TRPCClientErrorLike<AppRouter>; if (trpcError?.data?.code === 'NOT_FOUND' || trpcError?.data?.code === 'BAD_REQUEST') { return false; } return failureCount < 3; }, }
    );
  };

  // Mutations remain the same
  const createDespesaMutation = trpc.despesas.create.useMutation({ onSuccess: () => { toast({ title: "Sucesso", description: "Despesa criada.", }); utils.despesas.getAll.invalidate(); utils.dashboard.getStats.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: "Erro", description: error.message, variant: "destructive", }); }, });
  const updateDespesaMutation = trpc.despesas.update.useMutation({ onSuccess: (data, variables) => { toast({ title: "Sucesso", description: "Despesa atualizada.", }); utils.despesas.getById.invalidate({ id: variables.id }); utils.despesas.getAll.invalidate(); utils.dashboard.getStats.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: "Erro", description: error.message, variant: "destructive", }); }, });
  const reviewDespesaMutation = trpc.despesas.review.useMutation({ onSuccess: (data, variables) => { toast({ title: `Despesa ${variables.approvalStatus === 'Aprovado' ? 'Aprovada' : 'Rejeitada'}`, description: `Ação realizada com sucesso.`, }); utils.despesas.getById.invalidate({ id: variables.id }); utils.despesas.getAll.invalidate(); utils.dashboard.getStats.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>, variables) => { toast({ title: `Erro ao ${variables.approvalStatus === 'Aprovado' ? 'Aprovar' : 'Rejeitar'}`, description: error.message, variant: "destructive", }); } });
  const deleteDespesaMutation = trpc.despesas.delete.useMutation({ onSuccess: () => { toast({ title: "Sucesso", description: "Despesa excluída.", }); utils.despesas.getAll.invalidate(); utils.dashboard.getStats.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: "Erro", description: error.message, variant: "destructive", }); }, });

  // Filter update functions remain the same
  const updateFilters = useCallback((newFilters: Partial<DespesaFilterParams>) => { setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page !== undefined ? newFilters.page : 1 })); }, []);
  const resetFilters = useCallback(() => { setFilters({ page: 1, limit: 10, status: undefined, approvalStatus: undefined, category: undefined, empreendimento: undefined, startDate: undefined, endDate: undefined, search: undefined, sortBy: undefined, sortOrder: undefined, }); }, []);

  // Action functions remain the same
  const createDespesa = useCallback(async (data: CreateDespesaInput) => createDespesaMutation.mutateAsync(data), [createDespesaMutation]);
  const updateDespesa = useCallback(async (id: string, data: UpdateDespesaFormInput) => updateDespesaMutation.mutateAsync({ id, data }), [updateDespesaMutation]);
  const deleteDespesa = useCallback(async (id: string) => deleteDespesaMutation.mutateAsync({ id }), [deleteDespesaMutation]);
  const approveDespesa = useCallback(async (id: string, comments?: string) => reviewDespesaMutation.mutateAsync({ id, approvalStatus: 'Aprovado', notes: comments }), [reviewDespesaMutation]);
  const rejectDespesa = useCallback(async (id: string, comments: string) => reviewDespesaMutation.mutateAsync({ id, approvalStatus: 'Rejeitado', notes: comments }), [reviewDespesaMutation]);


  // Assign the potentially undefined pagination object with the correct type
  const paginationData: PaginationInfo | undefined = despesasQuery.data?.pagination;

  // Return values
  return {
    despesas: despesasQuery.data?.despesas || [],
    // Return the correctly typed pagination object
    pagination: paginationData, // This can be undefined
    filters,
    isLoading: despesasQuery.isLoading,
    isFetching: despesasQuery.isFetching,
    isCreating: createDespesaMutation.isPending,
    isUpdating: updateDespesaMutation.isPending,
    isDeleting: deleteDespesaMutation.isPending,
    isApproving: reviewDespesaMutation.isPending && reviewDespesaMutation.variables?.approvalStatus === 'Aprovado',
    isRejecting: reviewDespesaMutation.isPending && reviewDespesaMutation.variables?.approvalStatus === 'Rejeitado',
    getDespesaById,
    updateFilters,
    resetFilters,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    approveDespesa,
    rejectDespesa,
  };
}