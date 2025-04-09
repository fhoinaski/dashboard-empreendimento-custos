// app/dashboard/empreendimentos/[id]/despesas/page.tsx
"use client";

import React, { useEffect, useMemo, useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, DollarSign, CheckCircle, Eye, Plus, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { useDespesas } from "@/hooks/useDespesas";
import { ClientDespesa } from "@/lib/trpc/types";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Componente Skeleton para a página inteira
const DespesasListSkeleton = () => (
  <div className="space-y-6 px-4 sm:px-6 lg:px-8 animate-pulse">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48 sm:w-64" />
          <Skeleton className="h-4 w-56 sm:w-72" />
        </div>
      </div>
      <Skeleton className="h-8 w-full sm:w-[150px] rounded-md" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-muted"><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-6 w-12" /><Skeleton className="h-4 w-24" /></CardContent></Card>
      <Card className="bg-muted"><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-10" /><Skeleton className="h-4 w-20" /></CardContent></Card>
      <Card className="bg-muted"><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-6 w-8" /><Skeleton className="h-4 w-16" /></CardContent></Card>
    </div>
    <Card>
      <CardHeader className="py-3"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
      <CardContent className="pb-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>{Array.from({ length: 5 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}</TableRow></TableHeader>
            <TableBody>{Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>))}</TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default function DespesasEmpreendimentoListPage() {
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();

  // Local state to track which expense is being updated
  const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(null);

  // Hooks tRPC
  const { getEmpreendimentoById } = useEmpreendimentos();
  const {
    despesas,
    pagination,
    isLoading: isLoadingDespesasHook,
    isFetching: isFetchingDespesasHook,
    updateFilters,
    updateDespesa,
    isUpdating: isUpdatingDespesa,
  } = useDespesas();

  const {
    data: empreendimento,
    isLoading: isLoadingEmpreendimento,
    error: empreendimentoError,
  } = getEmpreendimentoById(id);

  // Fetch despesas when ID is available
  useEffect(() => {
    if (id) {
      console.log(`[DespesasEmpList] Atualizando filtro de despesas para empreendimento: ${id}`);
      updateFilters({ empreendimento: id, limit: 100, page: 1 });
    }
  }, [id, updateFilters]);

  // Handler to mark as paid
  const handleMarkAsPaid = useCallback(async (expenseId: string) => {
    try {
      setUpdatingExpenseId(expenseId); // Set the ID being updated
      // Corrigido: Passando apenas o status para evitar problemas de tipo com paymentMethod
      await updateDespesa(expenseId, { status: "Pago" });
    } catch (error) {
      console.error("Erro ao marcar despesa como paga (component):", error);
    } finally {
      setUpdatingExpenseId(null); // Clear the ID after update
    }
  }, [updateDespesa]);

  // Calculate expenses summary
  const expensesSummary = useMemo(() => {
    return (despesas || []).reduce((acc, e: ClientDespesa) => {
      acc.total++;
      acc.totalValue += e.value;
      if (e.status === "Pago") {
        acc.paid++;
        acc.paidValue += e.value;
      } else if (e.status === "Pendente" || e.status === "A vencer") {
        acc.pending++;
        acc.pendingValue += e.value;
      } else if (e.status === "Rejeitado") {
        acc.overdue++;
        acc.overdueValue += e.value;
      }
      return acc;
    }, { total: 0, paid: 0, pending: 0, overdue: 0, totalValue: 0, paidValue: 0, pendingValue: 0, overdueValue: 0 });
  }, [despesas]);

  // Loading and error states
  const isLoading = isLoadingEmpreendimento || isLoadingDespesasHook || isFetchingDespesasHook;
  const hasError = !!empreendimentoError;

  if (isLoading) return <DespesasListSkeleton />;
  if (hasError) {
    return (
      <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-center">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
        Erro ao carregar dados do empreendimento: {empreendimentoError?.message}
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">Tentar Novamente</Button>
      </div>
    );
  }
  if (!empreendimento) {
    return (
      <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Empreendimento Não Encontrado</h2>
        <p className="text-muted-foreground max-w-sm mb-6">O empreendimento solicitado não foi encontrado.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/empreendimentos">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Lista
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0">
              <Link href="/dashboard/empreendimentos" className="flex items-center justify-center">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Voltar</span>
              </Link>
            </Button>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={`Despesas de ${empreendimento.name}`}>
                Despesas de {empreendimento.name}
              </h2>
              <p className="text-muted-foreground flex items-center text-xs sm:text-sm truncate" title={empreendimento.address}>
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                {empreendimento.address}
              </p>
            </div>
          </div>
          <Button size="sm" asChild className="h-8 text-xs w-full sm:w-auto flex-shrink-0">
            <Link href={`/dashboard/despesas/novo?empreendimento=${id}`} className="flex items-center">
              <Plus className="mr-1 h-3 w-3" />
              <span>Nova Despesa</span>
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-muted">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs sm:text-sm text-muted-foreground">Pagas</div>
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-green-500">{expensesSummary.paid}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(expensesSummary.paidValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-muted">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs sm:text-sm text-muted-foreground">Pendentes/Vencer</div>
                <DollarSign className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-amber-500">{expensesSummary.pending}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(expensesSummary.pendingValue)}</div>
            </CardContent>
          </Card>
          <Card className="bg-muted">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs sm:text-sm text-muted-foreground">Rejeitadas</div>
                <DollarSign className="h-4 w-4 text-red-500" />
              </div>
              <div className="text-lg sm:text-xl font-bold text-red-500">{expensesSummary.overdue}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatCurrency(expensesSummary.overdueValue)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base sm:text-lg">Lista de Despesas</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Todas as despesas associadas a {empreendimento.name}</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 px-0 sm:px-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs px-2 h-8">Descrição</TableHead>
                    <TableHead className="text-xs px-2 h-8 hidden sm:table-cell text-right">Valor</TableHead>
                    <TableHead className="text-xs px-2 h-8 hidden sm:table-cell text-center">Vencimento</TableHead>
                    <TableHead className="text-xs px-2 h-8 hidden sm:table-cell text-center">Status</TableHead>
                    <TableHead className="text-right text-xs px-2 h-8">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(despesas || []).map((expense: ClientDespesa) => (
                    <TableRow key={expense._id} className={updatingExpenseId === expense._id ? "opacity-50 pointer-events-none" : ""}>
                      <TableCell className="font-medium text-xs p-2">
                        <span className="block truncate max-w-[150px] sm:max-w-xs" title={expense.description}>
                          {expense.description}
                        </span>
                        <div className="sm:hidden text-muted-foreground text-[11px] mt-0.5">
                          {formatCurrency(expense.value)} • Vence: {format(parseISO(expense.dueDate), "dd/MM/yy")} • {expense.status}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs p-2 hidden sm:table-cell text-right whitespace-nowrap">
                        {formatCurrency(expense.value)}
                      </TableCell>
                      <TableCell className="text-xs p-2 hidden sm:table-cell text-center whitespace-nowrap">
                        {format(parseISO(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs p-2 hidden sm:table-cell text-center">
                        <Badge
                          variant={expense.status === "Pago" ? "default" : expense.status === "Pendente" || expense.status === "A vencer" ? "secondary" : "destructive"}
                          className={cn("text-[10px] px-1.5 py-0.5", expense.status === "Pago" && "bg-green-100 text-green-800 border-green-200", (expense.status === "Pendente" || expense.status === "A vencer") && "bg-amber-100 text-amber-800 border-amber-200", expense.status === "Rejeitado" && "bg-red-100 text-red-800 border-red-200")}
                        >
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right p-1 sm:p-2">
                        <div className="flex justify-end gap-0.5 sm:gap-1">
                          {expense.status !== "Pago" && expense.approvalStatus !== "Rejeitado" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(expense._id); }}
                                  disabled={updatingExpenseId === expense._id || isUpdatingDespesa}
                                  className="h-7 w-7 p-0 text-green-600 hover:bg-green-100"
                                  aria-label="Marcar como Pago"
                                >
                                  {updatingExpenseId === expense._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Marcar como Pago</p></TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                                <Link href={`/dashboard/despesas/${expense._id}`} aria-label="Ver detalhes" className="flex items-center justify-center">
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Ver Detalhes</p></TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && (!despesas || despesas.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhuma despesa encontrada para este empreendimento.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {!isLoading && (!despesas || despesas.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
            <h3 className="text-base sm:text-lg font-medium">Nenhuma despesa encontrada</h3>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Adicione uma nova despesa para este empreendimento</p>
            <Link
              href={`/dashboard/despesas/novo?empreendimento=${id}`}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 mt-4"
            >
              <Plus className="h-4 w-4" />
              Nova Despesa
            </Link>
          </div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}