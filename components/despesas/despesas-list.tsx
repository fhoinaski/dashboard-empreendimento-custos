"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaginationControls } from '@/components/ui/pagination/pagination-controls';
import { FiltersCard } from '@/components/ui/filters/filters-card';
import { useDespesas } from '@/hooks/useDespesas';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDebounce } from '@/utils/debounce';
import { formatCurrency, formatDate } from '@/utils/format';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Plus, Eye, Loader2, AlertTriangle, CheckCircle, Search, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';
import { ClientDespesa, DespesaFilterParams, DespesaStatus, DespesaApprovalStatus } from '@/lib/trpc/types';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

type EmpreendimentoOption = { _id: string; name: string; };

const SkeletonTableRows = ({ columns, rowCount }: { columns: ColumnDef<ClientDespesa>[], rowCount: number }) => (
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

export default function DespesasList() {
    const router = useRouter();
    const { toast } = useToast();
    const { data: session } = useSession();

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

    const { despesas, pagination, isLoading, isFetching, updateFilters, approveDespesa, rejectDespesa, isApproving, isRejecting } = useDespesas();
    const { empreendimentos: empreendimentoOptions, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();

    const handleLocalFilterChange = useCallback((key: keyof typeof localFilters, value: any) => {
        setLocalFilters(prev => {
            let finalValue = value === 'todos' || value === '' ? undefined : value;
            if (key === 'status' && finalValue !== undefined) finalValue = [finalValue as DespesaStatus];
            const newFilters = { ...prev, [key]: finalValue };
            if (key !== 'page') newFilters.page = 1;
            return newFilters;
        });
    }, []);

    useEffect(() => {
        updateFilters({ ...localFilters, search: debouncedSearch });
    }, [localFilters, debouncedSearch, updateFilters]);

    const handleResetFilters = useCallback(() => {
        setLocalFilters({ page: 1, limit: 15, status: undefined, search: undefined, empreendimento: undefined, approvalStatus: undefined, category: undefined });
    }, []);

    const handleApprove = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try { await approveDespesa(id); } catch (error) { console.error("Approve failed:", error); }
    };
    const handleReject = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try { await rejectDespesa(id, "Rejeitado via lista"); } catch (error) { console.error("Reject failed:", error); }
    };

    const columns = useMemo((): ColumnDef<ClientDespesa>[] => [
        {
            accessorKey: 'description',
            header: 'Descrição',
            cell: ({ row }) => (
                <div>
                    <span className="font-medium truncate block max-w-[150px] sm:max-w-[200px] md:max-w-[250px]" title={row.original.description}>
                        {row.original.description}
                    </span>
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
            cell: ({ row }) => (
                <span className="truncate max-w-[100px] md:max-w-[150px] hidden md:block" title={row.original.empreendimento?.name ?? 'N/A'}>
                    {row.original.empreendimento?.name ?? 'N/A'}
                </span>
            ),
        },
        {
            accessorKey: 'dueDate',
            header: () => <div className="hidden sm:table-cell">Vencimento</div>,
            cell: ({ row }) => (
                <div className="whitespace-nowrap hidden sm:table-cell">{formatDate(row.original.dueDate)}</div>
            ),
        },
        {
            accessorKey: 'status',
            header: () => <div className="text-center hidden md:table-cell">Status Pag.</div>,
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Pago' ? 'default' : status === 'A vencer' ? 'secondary' : 'destructive';
                const bgColor = status === 'Pago' ? 'bg-green-100 text-green-800' : status === 'A vencer' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                return (
                    <div className="text-center hidden md:table-cell">
                        <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor)}>{status}</Badge>
                    </div>
                );
            },
        },
        {
            accessorKey: 'approvalStatus',
            header: () => <div className="text-center hidden lg:table-cell">Aprovação</div>,
            cell: ({ row }) => {
                const status = row.original.approvalStatus;
                const variant = status === 'Aprovado' ? 'default' : status === 'Pendente' ? 'secondary' : 'destructive';
                const bgColor = status === 'Aprovado' ? 'bg-green-100 text-green-800' : status === 'Pendente' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                return (
                    <div className="text-center hidden lg:table-cell">
                        <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor)}>{status}</Badge>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: () => <div className="text-right pr-2">Ações</div>,
            cell: ({ row }) => {
                const despesa = row.original;
                const isProcessingReview = (typeof isApproving === 'string' && isApproving === despesa._id) || (typeof isRejecting === 'string' && isRejecting === despesa._id);
                const canReview = session?.user?.role === 'admin';
                return (
                    <div className="flex justify-end items-center gap-1">
                        {canReview && despesa.approvalStatus === 'Pendente' && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={(e) => handleApprove(e, despesa._id)} disabled={!!isProcessingReview}>
                                            {typeof isApproving === 'string' && isApproving === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Aprovar</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100" onClick={(e) => handleReject(e, despesa._id)} disabled={!!isProcessingReview}>
                                            {typeof isRejecting === 'string' && isRejecting === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Rejeitar</p></TooltipContent>
                                </Tooltip>
                            </>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                    <Link href={`/dashboard/despesas/${despesa._id}`} onClick={(e) => e.stopPropagation()}>
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Ver Detalhes</p></TooltipContent>
                        </Tooltip>
                    </div>
                );
            },
        },
    ], [session?.user?.role, isApproving, isRejecting, handleApprove, handleReject]);

    const table = useReactTable({
        data: despesas as ClientDespesa[] ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: pagination?.pages ?? -1,
    });

    return (
        <TooltipProvider>
            <div className="space-y-4 px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                    <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">Despesas</h1>
                    <Button size="sm" asChild className="w-full sm:w-auto">
                        <Link href="/dashboard/despesas/novo">
                            <Plus className="mr-2 h-4 w-4" /> Nova Despesa
                        </Link>
                    </Button>
                </motion.div>

                <FiltersCard 
                title="Filtrar Despesas" onReset={handleResetFilters} isLoading={isLoading || isFetching} >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="flex items-center gap-2 col-span-1 lg:col-span-2">
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <Input
                                placeholder="Buscar descrição..."
                                value={localFilters.search ?? ''}
                                onChange={(e) => handleLocalFilterChange('search', e.target.value)}
                                disabled={isLoading || isFetching}
                                className="h-9 text-sm w-full"
                            />
                        </div>
                        <Select value={localFilters.empreendimento ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('empreendimento', value)} disabled={isLoadingEmpreendimentos || isLoading || isFetching}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Empreendimento" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos Empreendimentos</SelectItem>
                                {(empreendimentoOptions || []).map((emp: EmpreendimentoOption) => (
                                    <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={localFilters.status?.[0] ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('status', value)} disabled={isLoading || isFetching}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Status Pag." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos Status Pag.</SelectItem>
                                <SelectItem value="Pago">Pago</SelectItem>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                                <SelectItem value="A vencer">A vencer</SelectItem>
                                <SelectItem value="Rejeitado">Rejeitado (Pag.)</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={localFilters.approvalStatus ?? 'todos'} onValueChange={(value) => handleLocalFilterChange('approvalStatus', value)} disabled={isLoading || isFetching}>
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

                {isLoading || (isFetching && (!despesas || despesas.length === 0)) ? (
                    <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                ) : despesas.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma despesa encontrada {localFilters.search ? `para "${localFilters.search}"` : ''}.</p>
                ) : (
                    <>
                        {/* Mobile Card Layout */}
                        <div className="space-y-3 md:hidden">
                            {despesas.map((  (despesa) => {
                                const isProcessingReview = (typeof isApproving === 'string' && isApproving === despesa._id) || (typeof isRejecting === 'string' && isRejecting === despesa._id);
                                const canReview = session?.user?.role === 'admin';
                                return (
                                    <Card key={despesa._id} className={isProcessingReview ? 'opacity-50' : ''}>
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="font-medium truncate max-w-[200px]">{despesa.description}</p>
                                                    <p className="text-xs text-muted-foreground">{formatCurrency(despesa.value)} • Vence: {formatDate(despesa.dueDate)}</p>
                                                    <p className="text-xs text-muted-foreground">Empr: {despesa.empreendimento?.name ?? 'N/A'}</p>
                                                    <div className="flex gap-1 mt-1">
                                                        <Badge variant={despesa.status === 'Pago' ? 'default' : 'secondary'} className={cn("text-[9px] px-1 py-0", despesa.status === 'Pago' && 'bg-green-100 text-green-800')}>
                                                            {despesa.status}
                                                        </Badge>
                                                        <Badge variant={despesa.approvalStatus === 'Aprovado' ? 'default' : 'secondary'} className={cn("text-[9px] px-1 py-0", despesa.approvalStatus === 'Aprovado' && 'bg-green-100 text-green-800', despesa.approvalStatus === 'Rejeitado' && 'bg-red-100 text-red-800')}>
                                                            {despesa.approvalStatus}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    {canReview && despesa.approvalStatus === 'Pendente' && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-100" onClick={(e) => handleApprove(e, despesa._id)} disabled={isProcessingReview}>
                                                                {typeof isApproving === 'string' && isApproving === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:bg-red-100" onClick={(e) => handleReject(e, despesa._id)} disabled={isProcessingReview}>
                                                                {typeof isRejecting === 'string' && isRejecting === despesa._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                        <Link href={`/dashboard/despesas/${despesa._id}`} onClick={(e) => e.stopPropagation()}>
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            }))}
                        </div>

                        {/* Desktop Table Layout */}
                        <div className="hidden md:block rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => (
                                                <TableHead key={header.id} className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="hover:bg-muted/50 cursor-pointer"
                                            onClick={() => router.push(`/dashboard/despesas/${row.original._id}`)}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} className="px-3 py-2 text-xs sm:text-sm">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}

                {pagination && pagination.pages > 1 && !isLoading && (
                    <PaginationControls
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        onPageChange={(page) => handleLocalFilterChange('page', page)}
                        isDisabled={isFetching}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}