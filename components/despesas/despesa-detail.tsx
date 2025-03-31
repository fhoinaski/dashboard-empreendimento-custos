"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Building, Receipt, CheckCircle, Download, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loading } from "@/components/ui/loading";

export default function DespesaDetail({ id }: { id: string }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [despesa, setDespesa] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); // Ajustado para true inicialmente
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchDespesa() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/despesas/${id}`);
        if (!response.ok) throw new Error("Falha ao carregar despesa");
       
        
        const data = await response.json();
      
        setDespesa(data.despesa);
      } catch (error) {
        console.error("Erro ao carregar despesa:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao carregar detalhes da despesa",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchDespesa();
  }, [id, toast]);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/despesas/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao excluir despesa");
      }
      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso!",
      });
      setDeleteDialogOpen(false);
      router.push("/dashboard/despesas");
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao excluir despesa",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("status", "Pago");
      const response = await fetch(`/api/despesas/${id}`, {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error("Falha ao atualizar status");
      const updatedData = await response.json();
      setDespesa(updatedData.despesa);
      toast({
        title: "Sucesso",
        description: "Despesa marcada como paga!",
      });
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao marcar despesa como paga",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAttachment = (attachmentId: string) => {
    toast({
      title: "Download iniciado",
      description: "O arquivo está sendo baixado",
    });
    if (despesa?.attachments) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachment = despesa.attachments.find((a: any) => a.fileId === attachmentId);
      if (attachment?.url) window.open(attachment.url, "_blank");
    }
  };

  if (isLoading) return <Loading />;

  if (!despesa) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild className="h-8 w-8">
            <Link href="/dashboard/despesas">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Voltar</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-none">
              {despesa.description}
            </h2>
            <p className="text-muted-foreground flex items-center text-xs sm:text-sm">
              <Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{despesa.empreendimento.name}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {despesa.status !== "Pago" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsPaid}
              disabled={isLoading}
              className="h-8 text-xs w-full sm:w-auto"
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Marcar como pago
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:bg-muted">
            <Link href={`/dashboard/despesas/${id}/editar`}>
              <Edit className="h-4 w-4" />
              <span className="sr-only">Editar</span>
            </Link>
          </Button>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-destructive"
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Excluir</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Excluir despesa</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-end">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                  Excluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-base sm:text-lg">Detalhes da Despesa</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Informações detalhadas sobre a despesa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">Valor</p>
                <p className="font-medium text-base sm:text-lg">R$ {despesa.value.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <Badge
                  variant={
                    despesa.status === "Pago"
                      ? "outline"
                      : despesa.status === "Pendente" || despesa.status === "A vencer"
                      ? "secondary"
                      : "destructive"
                  }
                  className="mt-1 text-xs"
                >
                  {despesa.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Categoria</p>
                <p className="font-medium text-xs sm:text-sm">{despesa.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Data</p>
                <p className="font-medium flex items-center text-xs sm:text-sm">
                  <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                  {format(new Date(despesa.date), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Vencimento</p>
                <p className="font-medium flex items-center text-xs sm:text-sm">
                  <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                  {format(new Date(despesa.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Método de Pagamento</p>
                <p className="font-medium text-xs sm:text-sm">{despesa.paymentMethod || "Não informado"}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-base sm:text-lg font-medium mb-2">Observações</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">{despesa.notes || "Sem observações"}</p>
            </div>

            {despesa.attachments?.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-base sm:text-lg font-medium mb-2">Anexos</h3>
                  <div className="space-y-2">
                
                    {despesa.attachments.map((attachment: any) => (
                      <div
                        key={attachment.fileId}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-md gap-2"
                      >
                        <div className="flex items-center">
                          <Receipt className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="font-medium text-xs sm:text-sm truncate">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.url ? "Disponível" : "Indisponível"}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadAttachment(attachment.fileId)}
                          className="h-7 text-xs w-full sm:w-auto"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base sm:text-lg">Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-xs">Empreendimento</p>
              <p className="font-medium text-xs sm:text-sm">
                <Link
                  href={`/dashboard/empreendimentos/${despesa.empreendimento._id}`}
                  className="text-primary hover:underline"
                >
                  {despesa.empreendimento.name}
                </Link>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Criado por</p>
              <p className="font-medium text-xs sm:text-sm">{despesa.createdBy || "Usuário desconhecido"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Data de criação</p>
              <p className="font-medium text-xs sm:text-sm">
                {format(new Date(despesa.createdAt), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Última atualização</p>
              <p className="font-medium text-xs sm:text-sm">
                {format(new Date(despesa.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>

            <Separator />

            <div className="pt-2">
              <Button variant="outline" className="w-full text-xs sm:text-sm" asChild>
                <Link href={`/dashboard/despesas/${id}/historico`}>Ver histórico de alterações</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}