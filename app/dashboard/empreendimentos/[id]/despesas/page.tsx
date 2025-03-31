"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, DollarSign, CheckCircle, Eye, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loading } from "@/components/ui/loading";

export default function DespesasList() {
  const [despesas, setDespesas] = useState<any[]>([]);
  const [empreendimento, setEmpreendimento] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id } = useParams();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);

        // Fetch empreendimento
        const empreendimentoResponse = await fetch(`/api/empreendimentos/${id}`);
        if (!empreendimentoResponse.ok) throw new Error("Falha ao carregar empreendimento");
        const empreendimentoData = await empreendimentoResponse.json();
        setEmpreendimento(empreendimentoData.empreendimento);

        // Fetch despesas
        const despesasResponse = await fetch(`/api/despesas?empreendimento=${id}`);
        if (!despesasResponse.ok) throw new Error("Falha ao carregar despesas");
        const despesasData = await despesasResponse.json();
        setDespesas(despesasData.despesas);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao carregar despesas",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id, toast]);

  const handleMarkAsPaid = async (expenseId: string) => {
    try {
      const formData = new FormData();
      formData.append("status", "Pago");
      const response = await fetch(`/api/despesas/${expenseId}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error("Falha ao atualizar despesa");
      const updatedData = await response.json();
      setDespesas((prev) =>
        prev.map((exp) => (exp._id === expenseId ? updatedData.despesa : exp))
      );
      toast({
        title: "Sucesso",
        description: "Despesa marcada como paga com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao marcar despesa como paga:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao marcar despesa como paga",
      });
    }
  };

  if (isLoading || !empreendimento) {
    return <Loading />;
  }

  const expensesSummary = {
    total: despesas.length,
    paid: despesas.filter((e) => e.status === "Pago").length,
    pending: despesas.filter((e) => e.status === "Pendente" || e.status === "A vencer").length,
    overdue: despesas.filter((e) => e.status === "Atrasado").length,
    totalValue: despesas.reduce((sum, e) => sum + e.value, 0),
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href="/dashboard/empreendimentos">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Voltar</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-none">
              Despesas de {empreendimento.name}
            </h2>
            <p className="text-muted-foreground flex items-center text-xs sm:text-sm">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{empreendimento.address}</span>
            </p>
          </div>
        </div>
        <Button size="sm" asChild className="h-8 text-xs w-full sm:w-auto">
          <Link href={`/dashboard/despesas/novo?empreendimento=${id}`}>
            <Plus className="mr-1 h-3 w-3" />
            Nova Despesa
          </Link>
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-muted-foreground">Pagas</div>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-green-500">{expensesSummary.paid}</div>
            <div className="text-xs text-muted-foreground">
              R$ {despesas.filter((e) => e.status === "Pago").reduce((sum, e) => sum + e.value, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-muted-foreground">Pendentes</div>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-amber-500">{expensesSummary.pending}</div>
            <div className="text-xs text-muted-foreground">
              R$ {despesas.filter((e) => e.status === "Pendente" || e.status === "A vencer").reduce((sum, e) => sum + e.value, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs sm:text-sm text-muted-foreground">Atrasadas</div>
              <DollarSign className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-red-500">{expensesSummary.overdue}</div>
            <div className="text-xs text-muted-foreground">
              R$ {despesas.filter((e) => e.status === "Atrasado").reduce((sum, e) => sum + e.value, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Despesas */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base sm:text-lg">Lista de Despesas</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Todas as despesas associadas ao empreendimento</CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs px-2">Descrição</TableHead>
                  <TableHead className="text-xs px-2 hidden sm:table-cell">Valor</TableHead>
                  <TableHead className="text-xs px-2 hidden sm:table-cell">Data</TableHead>
                  <TableHead className="text-xs px-2 hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right text-xs px-2">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((expense) => (
                  <TableRow key={expense._id}>
                    <TableCell className="font-medium text-xs px-2">
                      {expense.description}
                      <div className="sm:hidden text-muted-foreground">
                        R$ {expense.value.toFixed(2)} •{" "}
                        {format(new Date(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })} • {expense.status}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs px-2 hidden sm:table-cell">
                      R$ {expense.value.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs px-2 hidden sm:table-cell">
                      {format(new Date(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs px-2 hidden sm:table-cell">
                      <Badge
                        variant={
                          expense.status === "Pago"
                            ? "outline"
                            : expense.status === "Pendente" || expense.status === "A vencer"
                            ? "secondary"
                            : "destructive"
                        }
                        className={
                          expense.status === "Pago"
                            ? "bg-green-100 text-green-800"
                            : expense.status === "Pendente" || expense.status === "A vencer"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }
                      >
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-2">
                      <div className="flex justify-end gap-1">
                        {expense.status !== "Pago" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsPaid(expense._id)}
                            className="h-7 text-xs"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Pago
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                          <Link href={`/dashboard/despesas/${expense._id}`}>
                            <Eye className="h-3 w-3" />
                            <span className="sr-only">Ver detalhes</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {despesas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <DollarSign className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
          <h3 className="text-base sm:text-lg font-medium">Nenhuma despesa encontrada</h3>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Adicione uma nova despesa para este empreendimento
          </p>
          <Button size="sm" className="mt-4 text-xs sm:text-sm" asChild>
            <Link href={`/dashboard/despesas/novo?empreendimento=${id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Despesa
            </Link>
          </Button>
        </div>
      )}
    </motion.div>
  );
}