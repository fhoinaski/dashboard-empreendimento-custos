// ============================================================
// NEW FILE: hooks/useTenants.ts
// ============================================================
import { trpc } from '@/lib/trpc/client';
import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type {
    ListTenantsFilterInput,
    UpdateTenantStatusInput,
    CreateTenantWithAdminInput,
    TenantListItem, // Importar o tipo do item individual
    TenantListResponse, // Importar o tipo da resposta da lista
} from '@/server/api/schemas/tenants'; // Ajuste o caminho se necessário
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '@/server/api/root';

// Tipo para os dados retornados pelo hook, incluindo a lista e paginação
interface UseTenantsReturn {
    tenants: TenantListItem[]; // Usar o tipo do item
    pagination: TenantListResponse['pagination'] | null; // Usar o tipo da resposta
    filters: ListTenantsFilterInput;
    isLoading: boolean;
    isFetching: boolean;
    updateFilters: (newFilters: Partial<ListTenantsFilterInput>) => void;
    resetFilters: () => void;
    updateTenantStatus: (input: UpdateTenantStatusInput) => Promise<void>;
    createTenant: (input: CreateTenantWithAdminInput) => Promise<void>;
    isUpdatingStatus: boolean;
    isCreatingTenant: boolean;
    // getTenantDetails: (id: string) => UseQueryResult<TenantDetailsResponse | null>; // Exemplo para detalhes
}

export function useTenants(): UseTenantsReturn {
    const { toast } = useToast();
    const utils = trpc.useContext();

    const [filters, setFilters] = useState<ListTenantsFilterInput>({
        page: 1,
        limit: 15, // Padrão
        sortBy: 'createdAt',
        sortOrder: 'desc',
    });

    // --- Query para Listar Tenants ---
    const tenantsQuery = trpc.tenants.listTenants.useQuery(filters, {
        staleTime: 1000 * 60 * 5, // 5 minutos
        placeholderData: (previousData) => previousData, // Mantém dados antigos enquanto busca novos
    });

    // --- Mutations ---
    const updateStatusMutation = trpc.tenants.updateStatus.useMutation({
        onSuccess: (data) => {
            toast({ title: "Sucesso", description: data.message });
            utils.tenants.listTenants.invalidate(); // Invalida a lista após sucesso
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({ title: "Erro ao Atualizar Status", description: error.message, variant: "destructive" });
        },
    });

    const createTenantMutation = trpc.tenants.createTenant.useMutation({
        onSuccess: (data) => {
            toast({ title: "Sucesso", description: data.message });
            utils.tenants.listTenants.invalidate(); // Invalida a lista após sucesso
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({ title: "Erro ao Criar Tenant", description: error.message, variant: "destructive" });
        },
    });

    // --- Funções de Ação ---
    const updateFilters = useCallback((newFilters: Partial<ListTenantsFilterInput>) => {
        setFilters(prev => {
            const shouldResetPage = Object.keys(newFilters).some(key => key !== 'page');
            return { ...prev, ...newFilters, page: shouldResetPage ? 1 : (newFilters.page ?? prev.page) };
        });
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({
            page: 1,
            limit: 15,
            sortBy: 'createdAt',
            sortOrder: 'desc',
            status: undefined,
            search: undefined,
        });
    }, []);

    const updateTenantStatus = useCallback(async (input: UpdateTenantStatusInput) => {
        return updateStatusMutation.mutateAsync(input).then(() => {}).catch(() => {}); // Promise vazia no catch para evitar erro não tratado
    }, [updateStatusMutation]);

    const createTenant = useCallback(async (input: CreateTenantWithAdminInput) => {
        return createTenantMutation.mutateAsync(input).then(() => {}).catch(() => {}); // Promise vazia no catch
    }, [createTenantMutation]);

    // --- Tratamento de Erro da Query ---
    useEffect(() => {
        if (tenantsQuery.error) {
            console.error("[useTenants] Erro ao buscar tenants:", tenantsQuery.error);
            toast({ title: "Erro ao Carregar", description: tenantsQuery.error.message, variant: "destructive" });
        }
    }, [tenantsQuery.error, toast]);

    return {
        tenants: tenantsQuery.data?.tenants || [],
        pagination: tenantsQuery.data?.pagination || null,
        filters,
        isLoading: tenantsQuery.isLoading,
        isFetching: tenantsQuery.isFetching,
        updateFilters,
        resetFilters,
        updateTenantStatus,
        createTenant,
        isUpdatingStatus: updateStatusMutation.isPending,
        isCreatingTenant: createTenantMutation.isPending,
    };
}
// ============================================================
// END OF HOOK FILE
// ============================================================