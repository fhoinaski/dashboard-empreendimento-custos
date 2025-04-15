// ============================================================
// REFACTORED FILE: components/admin/tenants/tenant-management-page.tsx
// (Added TooltipProvider to wrap TenantListTable)
// ============================================================
"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Building, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTenants } from '@/hooks/useOrganizacoes'; // Hook para buscar e gerenciar tenants
import TenantListTable from './tenant-list-table'; // Tabela de tenants
import CreateTenantForm from './create-tenant-form'; // Formulário de criação
import { useDebounce } from '@/utils/debounce'; // Hook de debounce para busca
import type { ListTenantsFilterInput, TenantStatus } from '@/server/api/schemas/tenants';
import { FiltersCard } from '@/components/ui/filters/filters-card'; // Componente de filtro
// *** ADICIONAR IMPORT ***
import { TooltipProvider } from '@/components/ui/tooltip';

// Tipos locais (sem alteração)
type StatusFilter = TenantStatus | 'todos';

export default function TenantManagementPage() {
    const [createTenantDialogOpen, setCreateTenantDialogOpen] = useState(false);
    const [localSearchTerm, setLocalSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

    const debouncedSearchTerm = useDebounce(localSearchTerm, 500);

    const {
        tenants,
        pagination,
        filters,
        isLoading,
        isFetching,
        updateFilters,
        resetFilters,
    } = useTenants();

    // Atualiza os filtros do hook quando os filtros locais (ou debounce) mudam (sem alteração)
    React.useEffect(() => {
        const newFilters: Partial<ListTenantsFilterInput> = {
            search: debouncedSearchTerm || undefined,
            status: statusFilter === 'todos' ? undefined : statusFilter,
            page: 1, // Reseta a página ao aplicar filtros
        };
        updateFilters(newFilters);
    }, [debouncedSearchTerm, statusFilter, updateFilters]);

    // Handlers (sem alteração)
    const handlePageChange = useCallback((page: number) => {
        updateFilters({ page });
    }, [updateFilters]);

    const handleResetFilters = useCallback(() => {
        setLocalSearchTerm('');
        setStatusFilter('todos');
        resetFilters(); // Chama a função de reset do hook
    }, [resetFilters]);

    const isFilteringOrLoading = isLoading || isFetching;

    return (
        // *** Envolver o conteúdo principal com TooltipProvider ***
        <TooltipProvider>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6" // Adiciona espaçamento geral
            >
                {/* Cabeçalho (sem alteração) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Building className="h-6 w-6 text-primary" />
                            Gerenciamento de Tenants (Super Admin)
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Crie, visualize e gerencie os tenants da plataforma.
                        </p>
                    </div>
                    <Dialog open={createTenantDialogOpen} onOpenChange={setCreateTenantDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" /> Novo Tenant
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Criar Novo Tenant</DialogTitle>
                            </DialogHeader>
                            <CreateTenantForm onSuccess={() => setCreateTenantDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Card de Filtros (sem alteração) */}
                <FiltersCard title="Filtrar Tenants" onReset={handleResetFilters} isLoading={isFilteringOrLoading}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <Input
                                placeholder="Buscar por nome ou slug..."
                                value={localSearchTerm}
                                onChange={(e) => setLocalSearchTerm(e.target.value)}
                                disabled={isFilteringOrLoading}
                                className="h-9 text-sm w-full"
                            />
                        </div>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                            disabled={isFilteringOrLoading}
                        >
                            <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos Status</SelectItem>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="suspended">Suspenso</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </FiltersCard>

                {/* Tabela de Tenants (agora dentro do Provider) */}
                <TenantListTable
                    tenants={tenants}
                    pagination={pagination}
                    isLoading={isLoading || isFetching} // Passa estado combinado de loading/fetching
                    onPageChange={handlePageChange}
                />
            </motion.div>
        </TooltipProvider> // *** Fechar TooltipProvider ***
    );
}
// ============================================================
// END OF REFACTORED FILE
// ============================================================