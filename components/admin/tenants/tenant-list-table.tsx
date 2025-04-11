// ============================================================
// REFACTORED FILE: components/admin/tenants/tenant-list-table.tsx
// (Fix TS2678, TS2367, TS2304 - Status typo and missing Loader2 import)
// ============================================================
"use client";

import React, { useMemo } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationControls } from '@/components/ui/pagination/pagination-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// *** CORREÇÃO: Adicionar Loader2 à importação ***
import { Eye, Edit, Users, AlertTriangle, CheckCircle, Clock, Ban, Loader2 } from 'lucide-react';
import { TenantListItem, TenantStatus } from '@/server/api/schemas/tenants'; // Importar tipos
import type { PaginationInfo } from '@/lib/trpc/types'; // Importar tipo de paginação
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useTenants } from '@/hooks/useTenants'; // Para ação de updateStatus

interface TenantListTableProps {
    tenants: TenantListItem[];
    pagination: PaginationInfo | null;
    isLoading: boolean;
    onPageChange: (page: number) => void;
    // Adicionar props para handlers de ação (opcional por enquanto)
    // onViewDetails: (tenantId: string) => void;
    // onManageAdmins: (tenantId: string) => void;
    // onUpdateStatus: (tenantId: string, status: TenantStatus) => void;
}

// Helper para status badge
const getStatusBadgeVariant = (status: TenantStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'active': return 'default';
        case 'pending': return 'secondary';
        case 'suspended': return 'outline';
        // *** CORREÇÃO: Usar 'cancelled' ***
        case 'cancelled': return 'destructive';
        default: return 'outline';
    }
};
const getStatusBadgeClasses = (status: TenantStatus): string => {
    switch (status) {
        case 'active': return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
        case 'pending': return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700';
        case 'suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
        // *** CORREÇÃO: Usar 'cancelled' ***
        case 'cancelled': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
        default: return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/30 dark:text-gray-300 dark:border-gray-600';
    }
};
const getStatusIcon = (status: TenantStatus): React.ReactNode => {
    switch (status) {
        case 'active': return <CheckCircle className="h-3 w-3" />;
        case 'pending': return <Clock className="h-3 w-3" />;
        case 'suspended': return <Ban className="h-3 w-3" />;
        // *** CORREÇÃO: Usar 'cancelled' ***
        case 'cancelled': return <AlertTriangle className="h-3 w-3" />;
        default: return null;
    }
};

// Skeleton para linhas da tabela
const SkeletonTableRows = ({ columns, rowCount }: { columns: ColumnDef<TenantListItem>[], rowCount: number }) => (
    <TableBody>
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <TableRow key={`skel-row-${rowIndex}`} className="animate-pulse">
                {columns.map((column, colIndex) => (
                    <TableCell key={`skel-cell-${rowIndex}-${(column as any).id || colIndex}`} className="py-3 px-3">
                        <Skeleton className="h-5 w-full" />
                    </TableCell>
                ))}
            </TableRow>
        ))}
    </TableBody>
);

export default function TenantListTable({
    tenants,
    pagination,
    isLoading,
    onPageChange,
}: TenantListTableProps) {

    const { updateTenantStatus, isUpdatingStatus } = useTenants(); // Para usar na ação de mudar status

    // Definição das colunas da tabela
    const columns = useMemo((): ColumnDef<TenantListItem>[] => [
        { accessorKey: 'name', header: 'Nome Tenant', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: 'slug', header: 'Slug', cell: ({ row }) => <span className="text-xs text-muted-foreground font-mono">{row.original.slug}</span> },
        {
            accessorKey: 'admin',
            header: 'Admin Principal',
            cell: ({ row }) => (
                <div className="text-xs">
                    {row.original.admin ? (
                        <>
                            <p className="truncate max-w-[150px]" title={row.original.admin.name}>{row.original.admin.name}</p>
                            <p className="text-muted-foreground truncate max-w-[150px]" title={row.original.admin.email}>{row.original.admin.email}</p>
                        </>
                    ) : (
                        <span className="text-muted-foreground italic">N/A</span>
                    )}
                </div>
            )
        },
        { accessorKey: 'userCount', header: () => <div className="text-center">Usuários</div>, cell: ({ row }) => <div className="text-center">{row.original.userCount}</div> },
        {
            accessorKey: 'status',
            header: () => <div className="text-center">Status</div>,
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge
                        variant={getStatusBadgeVariant(row.original.status)}
                        className={cn("text-[10px] px-1.5 py-0.5", getStatusBadgeClasses(row.original.status))}
                    >
                        <span className="flex items-center gap-1 capitalize"> {/* Adicionado capitalize */}
                             {getStatusIcon(row.original.status)} {row.original.status}
                        </span>
                    </Badge>
                </div>
            )
        },
        {
            id: 'integrations',
            header: () => <div className="text-center">Integrações</div>, // Alinhado ao centro
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-1.5">
                    <Tooltip>
                        <TooltipTrigger>
                            <div className={cn("h-3 w-3 rounded-full border", row.original.integrationSettings.googleDriveEnabled ? 'bg-green-500 border-green-600' : 'bg-muted border-muted-foreground/50')}></div>
                        </TooltipTrigger>
                        <TooltipContent><p>Google Drive: {row.original.integrationSettings.googleDriveEnabled ? 'Ativo' : 'Inativo'}</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger>
                            <div className={cn("h-3 w-3 rounded-full border", row.original.integrationSettings.googleSheetsEnabled ? 'bg-green-500 border-green-600' : 'bg-muted border-muted-foreground/50')}></div>
                        </TooltipTrigger>
                        <TooltipContent><p>Google Sheets: {row.original.integrationSettings.googleSheetsEnabled ? 'Ativo' : 'Inativo'}</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger>
                            <div className={cn("h-3 w-3 rounded-full border", row.original.integrationSettings.googleServiceAccountConfigured ? 'bg-blue-500 border-blue-600' : 'bg-muted border-muted-foreground/50')}></div>
                        </TooltipTrigger>
                        <TooltipContent><p>Credencial Google: {row.original.integrationSettings.googleServiceAccountConfigured ? 'Configurada' : 'Pendente'}</p></TooltipContent>
                    </Tooltip>
                </div>
            )
        },
        {
            accessorKey: 'createdAt',
            header: () => <div className="hidden md:table-cell text-center">Criado em</div>, // Alinhado
            cell: ({ row }) => (
                <div className="text-xs text-muted-foreground hidden md:table-cell text-center">
                    {format(new Date(row.original.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                </div>
            )
        },
        {
            id: 'actions',
            header: () => <div className="text-right">Ações</div>,
            cell: ({ row }) => {
                const tenant = row.original;
                // Verifica se a mutation está atualizando ESTE tenant específico
                const isUpdatingThis = isUpdatingStatus;

                return (
                    <div className="flex justify-end items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isUpdatingThis}>
                                    <Eye className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Ver Detalhes (WIP)</p></TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isUpdatingThis}>
                                    <Users className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Gerenciar Admins (WIP)</p></TooltipContent>
                        </Tooltip>
                         {/* *** CORREÇÃO: Comparar com 'cancelled' *** */}
                         {tenant.status !== 'cancelled' && (
                             <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button
                                         variant="ghost"
                                         size="icon"
                                         className={cn("h-7 w-7", tenant.status === 'suspended' ? 'text-green-600 hover:bg-green-100' : 'text-yellow-600 hover:bg-yellow-100')}
                                         // *** CORREÇÃO: Lógica de status e acesso à mutation/variables ***
                                         onClick={() => {
                                            if (!isUpdatingThis) { // Prevenir cliques múltiplos
                                                 updateTenantStatus({ tenantId: tenant._id, status: tenant.status === 'suspended' ? 'active' : 'suspended' })
                                            }
                                          }}
                                         disabled={isUpdatingThis} // Desabilita durante o update DESTE item
                                     >
                                        {/* *** CORREÇÃO: Acessar estado/variáveis da mutation corretamente *** */}
                                         {isUpdatingThis ? <Loader2 className="h-4 w-4 animate-spin"/> : (tenant.status === 'suspended' ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />)}
                                     </Button>
                                 </TooltipTrigger>
                                 <TooltipContent><p>{tenant.status === 'suspended' ? 'Reativar Tenant' : 'Suspender Tenant'}</p></TooltipContent>
                             </Tooltip>
                         )}
                    </div>
                );
            }
        },
    // *** CORREÇÃO: Acesso correto aos dados da mutation para dependência ***
    ], [updateTenantStatus, isUpdatingStatus]);

    const table = useReactTable({
        data: tenants ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: pagination?.pages ?? -1,
    });

    const currentPage = pagination?.page ?? 1;
    const totalPages = pagination?.pages ?? 0;

    return (
        <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <TableHead key={header.id} className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    {isLoading ? (
                        <SkeletonTableRows columns={columns} rowCount={pagination?.limit ?? 10} />
                    ) : table.getRowModel().rows?.length > 0 ? (
                        <TableBody>
                            {table.getRowModel().rows.map(row => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map(cell => (
                                        <TableCell key={cell.id} className="px-3 py-2 text-xs sm:text-sm">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    ) : (
                         <TableBody>
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    Nenhum tenant encontrado.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    )}
                </Table>
            </div>

            {/* Controles de Paginação */}
            {pagination && totalPages > 1 && !isLoading && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    isDisabled={isLoading} // Passar estado de loading
                />
            )}
        </div>
    );
}
// ============================================================
// END OF REFACTORED FILE
// ============================================================