// hooks/useEmpreendimentos.ts
import { trpc } from '@/lib/trpc/client';
import { useCallback, useState, useEffect } from 'react';
import {
    createEmpreendimentoSchema,
    updateEmpreendimentoSchema,
    type UpdateEmpreendimentoInput
} from '@/server/api/schemas/empreendimentos';
import { type S3UploadInput, type S3UploadResponse } from '@/server/api/schemas/upload';
import { z } from 'zod';
import { useToast } from '@/components/ui/use-toast';
// import { TRPCClientErrorLike } from '@trpc/client'; // REMOVIDO
import { AppRouter } from '@/server/api/root';
import { skipToken } from '@tanstack/react-query';
// *** CORREÇÃO: Importar os tipos corretos de types.ts ***
import type { ClientEmpreendimento, EmpreendimentoFilterParams } from '@/lib/trpc/types';

export function useEmpreendimentos() {
    const { toast } = useToast();
    const utils = trpc.useContext();

    // Usar o tipo importado
    const [filters, setFilters] = useState<EmpreendimentoFilterParams>({
        page: 1,
        limit: 10,
        searchTerm: undefined,
        status: undefined,
        type: undefined,
    });

    // Query para listar empreendimentos
    const empreendimentosQuery = trpc.empreendimentos.getAll.useQuery(
        { // Passa os filtros corretamente tipados
            page: filters.page,
            limit: filters.limit,
            searchTerm: filters.searchTerm,
            // Zod no backend já lida com 'todos' sendo undefined
            status: filters.status === 'todos' as string ? undefined : filters.status,
            type: filters.type === 'todos' as string ? undefined : filters.type,
        },
        {
            placeholderData: (previousData) => previousData,
            staleTime: 1000 * 60 * 5,
            enabled: typeof filters.page === 'number' && typeof filters.limit === 'number',
        }
    );

    useEffect(() => {
        if (empreendimentosQuery.error) {
            console.error("Erro ao buscar empreendimentos:", empreendimentosQuery.error);
            toast({ title: "Erro", description: empreendimentosQuery.error.message || "Não foi possível carregar.", variant: "destructive" });
        }
    }, [empreendimentosQuery.error, toast]);

    // Query para buscar por ID
    const getEmpreendimentoById = (id: string | undefined | null) => {
        const isIdProvided = !!id;
        const queryInput = isIdProvided ? { id } : skipToken;
        return trpc.empreendimentos.getById.useQuery(queryInput, {
            staleTime: 1000 * 60 * 5, enabled: isIdProvided,
             retry: (failureCount, error: any) => {
                 const isNotFoundError = error?.data?.code === 'NOT_FOUND' || error?.data?.code === 'BAD_REQUEST';
                 if (isNotFoundError) return false;
                 return failureCount < 3;
             },
        });
    };

    // --- MUTATIONS ---
    const createEmpreendimentoMutation = trpc.empreendimentos.create.useMutation({
        onSuccess: (data) => { toast({ title: "Sucesso", description: "Empreendimento criado." }); utils.empreendimentos.getAll.invalidate(); },
        onError: (error: any) => { toast({ title: "Erro ao Criar", description: error.message || 'Erro', variant: "destructive" }); },
    });
    const updateEmpreendimentoMutation = trpc.empreendimentos.update.useMutation({
        onSuccess: (data, variables) => { toast({ title: "Sucesso", description: "Empreendimento atualizado." }); utils.empreendimentos.getById.invalidate({ id: variables.id }); utils.empreendimentos.getAll.invalidate(); },
        onError: (error: any) => { toast({ title: "Erro ao Atualizar", description: error.message || 'Erro', variant: "destructive" }); },
    });
    const deleteEmpreendimentoMutation = trpc.empreendimentos.delete.useMutation({
        onSuccess: () => { toast({ title: "Sucesso", description: "Empreendimento excluído." }); utils.empreendimentos.getAll.invalidate(); },
        onError: (error: any) => { toast({ title: "Erro ao Excluir", description: error.message || 'Erro', variant: "destructive" }); },
    });

    // --- Filter update functions ---
    // *** CORREÇÃO: Adicionar tipo explícito para 'prev' ***
    const updateFilters = useCallback((newFilters: Partial<EmpreendimentoFilterParams>) => {
        setFilters((prev: EmpreendimentoFilterParams) => { // Tipar 'prev'
            const shouldResetPage = Object.keys(newFilters).some(key => key !== 'page');
            return { ...prev, ...newFilters, page: shouldResetPage ? 1 : (newFilters.page ?? prev.page) };
        });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({ page: 1, limit: 10, searchTerm: undefined, status: undefined, type: undefined });
    }, []);

    // --- ACTION FUNCTIONS ---
    const createEmpreendimento = useCallback(async (data: z.infer<typeof createEmpreendimentoSchema>) => createEmpreendimentoMutation.mutateAsync(data), [createEmpreendimentoMutation]);
    const updateEmpreendimento = useCallback(async ({ id, data }: { id: string; data: UpdateEmpreendimentoInput }) => updateEmpreendimentoMutation.mutateAsync({ id, data }), [updateEmpreendimentoMutation]);
    const deleteEmpreendimento = useCallback(async (id: string) => deleteEmpreendimentoMutation.mutateAsync({ id }), [deleteEmpreendimentoMutation]);

    return {
        // Queries
        // Usar o tipo ClientEmpreendimento aqui
        empreendimentos: empreendimentosQuery.data?.empreendimentos as ClientEmpreendimento[] || [],
        totalEmpreendimentos: empreendimentosQuery.data?.pagination?.total || 0,
        totalPages: empreendimentosQuery.data?.pagination?.pages || 0,
        filters,
        isLoading: empreendimentosQuery.isLoading,
        isFetching: empreendimentosQuery.isFetching,
        getEmpreendimentoById,

        // Mutations States
        isCreating: createEmpreendimentoMutation.isPending,
        isUpdating: updateEmpreendimentoMutation.isPending,
        isDeleting: deleteEmpreendimentoMutation.isPending,

        // Filter Functions
        updateFilters,
        resetFilters,

        // Action Functions
        createEmpreendimento,
        updateEmpreendimento,
        deleteEmpreendimento,
    };
}

// Exportar tipos localmente se não usar types.ts centralizado
// export type { ClientEmpreendimento, EmpreendimentoFilterParams };