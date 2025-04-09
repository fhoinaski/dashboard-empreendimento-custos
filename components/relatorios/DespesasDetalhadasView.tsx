// components/relatorios/DespesasDetalhadasView.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useDespesas } from "@/hooks/useDespesas";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency, formatDate } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import Link from "next/link";
import { PaginationControls } from "@/components/ui/pagination/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDespesa } from "@/lib/trpc/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  dateRange?: { from?: Date; to?: Date };
  empreendimentoId?: string;
}

export default function DespesasDetalhadasView({ dateRange, empreendimentoId }: Props) {
  const {
    despesas,
    pagination,
    isLoading,
    isFetching,
    updateFilters,
  } = useDespesas();

  const currentPage = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 10;
  const totalPages = pagination?.pages ?? 0;

  useEffect(() => {
    updateFilters({
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
      empreendimento: empreendimentoId !== "todos" ? empreendimentoId : undefined,
      page: currentPage,
      limit: limit,
    });
  }, [dateRange, empreendimentoId, currentPage, limit, updateFilters]);

  const columns = useMemo((): ColumnDef<ClientDespesa>[] => [
    { accessorKey: "description", header: "Descrição", cell: ({ row }) => <span className="truncate block max-w-[250px]" title={row.original.description}>{row.original.description}</span> },
    { accessorKey: "empreendimento.name", header: "Empreendimento", cell: ({ row }) => <span className="truncate block max-w-[150px]" title={row.original.empreendimento?.name ?? "N/A"}>{row.original.empreendimento?.name ?? "N/A"}</span> },
    { accessorKey: "value", header: () => <div className="text-right">Valor</div>, cell: ({ row }) => <div className="text-right whitespace-nowrap">{formatCurrency(row.original.value)}</div> },
    { accessorKey: "category", header: "Categoria", cell: ({ row }) => row.original.category },
    { accessorKey: "date", header: "Data Despesa", cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: "dueDate", header: "Vencimento", cell: ({ row }) => formatDate(row.original.dueDate) },
    {
      accessorKey: "status",
      header: "Status Pag.",
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        let bgColor = "bg-gray-100 dark:bg-gray-800";
        let textColor = "text-gray-800 dark:text-gray-300";
        let borderColor = "border-gray-300 dark:border-gray-600";
        if (status === "Pago") {
          variant = "default";
          bgColor = "bg-green-100 dark:bg-green-900/30";
          textColor = "text-green-800 dark:text-green-300";
          borderColor = "border-green-300 dark:border-green-700";
        } else if (status === "A vencer") {
          variant = "secondary";
          bgColor = "bg-amber-100 dark:bg-amber-900/30";
          textColor = "text-amber-800 dark:text-amber-300";
          borderColor = "border-amber-300 dark:border-amber-700";
        } else if (status === "Pendente" || status === "Rejeitado") {
          variant = "destructive";
          bgColor = "bg-red-100 dark:bg-red-900/30";
          textColor = "text-red-800 dark:text-red-300";
          borderColor = "border-red-300 dark:border-red-700";
        }
        return <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge>;
      },
    },
    {
      accessorKey: "approvalStatus",
      header: "Aprovação",
      cell: ({ row }) => {
        const status = row.original.approvalStatus;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        let bgColor = "bg-gray-100 dark:bg-gray-800";
        let textColor = "text-gray-800 dark:text-gray-300";
        let borderColor = "border-gray-300 dark:border-gray-600";
        if (status === "Aprovado") {
          variant = "default";
          bgColor = "bg-green-100 dark:bg-green-900/30";
          textColor = "text-green-800 dark:text-green-300";
          borderColor = "border-green-300 dark:border-green-700";
        } else if (status === "Pendente") {
          variant = "secondary";
          bgColor = "bg-amber-100 dark:bg-amber-900/30";
          textColor = "text-amber-800 dark:text-amber-300";
          borderColor = "border-amber-300 dark:border-amber-700";
        } else if (status === "Rejeitado") {
          variant = "destructive";
          bgColor = "bg-red-100 dark:bg-red-900/30";
          textColor = "text-red-800 dark:text-red-300";
          borderColor = "border-red-300 dark:border-red-700";
        }
        return <Badge variant={variant} className={cn("text-[10px] px-1.5 py-0.5", bgColor, textColor, borderColor)}>{status}</Badge>;
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href={`/dashboard/despesas/${row.original._id}`} aria-label="Ver detalhes">
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ], []);

  const TableSkeleton = () => (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col: any) => (
                <TableHead key={col.id || col.accessorKey}><Skeleton className="h-5 w-full" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: limit }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                {columns.map((col: any) => (
                  <TableCell key={`skel-cell-${i}-${col.id || col.accessorKey}`}><Skeleton className="h-5 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas Detalhadas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || isFetching ? (
          <TableSkeleton />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={despesas as ClientDespesa[] ?? []}
              isLoading={false}
            />
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => updateFilters({ page })}
                isDisabled={isLoading || isFetching}
              />
            )}
            {!isLoading && despesas.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                Nenhuma despesa encontrada para os filtros selecionados.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}