"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Attachment {
  fileId: string;
  name: string;
  url: string;
}

interface Despesa {
  _id: string;
  description: string;
  value: number;
  status: string;
  empreendimento: {
    name: string;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy?: string;
  attachments: Attachment[];
}

interface HistoryChange {
  field: string;
  value: string;
}

interface HistoryEntry {
  id: number;
  date: string;
  user: string;
  action: string;
  changes: HistoryChange[];
  attachments: {  // Removido o ? para tornar obrigatório
    id: string;
    name: string;
    type: string;
    size: string;
  }[];
}

export default function DespesaHistorico({ id }: { id: string }) {
  const [despesa, setDespesa] = useState<Despesa | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchDespesa() {
      try {
        const response = await fetch(`/api/despesas/${id}`);
        if (!response.ok) throw new Error("Falha ao carregar despesa");
        const data = await response.json();
        setDespesa(data.despesa);
      } catch (error) {
        console.error("Erro ao carregar despesa:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao carregar histórico da despesa",
        });
      }
    }
    fetchDespesa();
  }, [id, toast]);

  const generateHistory = (despesa: Despesa): HistoryEntry[] => {
    return [
      {
        id: 1,
        date: format(new Date(despesa.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        user: despesa.createdBy || "Usuário desconhecido",
        action: "Criação",
        changes: [
          { field: "Descrição", value: despesa.description },
          { field: "Valor", value: `R$ ${despesa.value.toFixed(2)}` },
          { field: "Status", value: despesa.status },
          { field: "Empreendimento", value: despesa.empreendimento.name },
        ],
        attachments: [], // Array vazio como padrão para a criação
      },
      {
        id: 2,
        date: format(new Date(despesa.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        user: "Sistema",
        action: "Atualização",
        changes: despesa.attachments.length > 0 ? [{ field: "Anexos", value: "Adicionados" }] : [],
        attachments: despesa.attachments.map((attachment) => ({
          id: attachment.fileId,
          name: attachment.name,
          type: attachment.url.split(".").pop()?.toUpperCase() || "DESCONHECIDO",
          size: "Desconhecido",
        })),
      },
    ].filter((entry) => entry.changes.length > 0 || entry.attachments.length > 0);
  };

  if (!despesa) return <div>Carregando...</div>;

  const historicalChanges = generateHistory(despesa);


  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/despesas/${id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Voltar</span>
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Histórico da Despesa</h2>
          <p className="text-muted-foreground">Visualize o histórico de alterações desta despesa</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
          <CardDescription>Todas as alterações realizadas nesta despesa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border-l border-muted pl-6 ml-3">
            {historicalChanges.map((change) => (
              <div key={change.id} className="mb-8 relative">
                <div className="absolute -left-9 mt-1.5 h-4 w-4 rounded-full border border-primary bg-background"></div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={change.action === "Criação" ? "default" : "outline"}>{change.action}</Badge>
                  <time className="text-sm font-normal leading-none text-muted-foreground flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {change.date}
                  </time>
                  <span className="text-sm font-normal leading-none text-muted-foreground flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {change.user}
                  </span>
                </div>

                <div className="space-y-2 mt-3">
                  {change.changes.map((item, i) => (
                    <div key={i} className="bg-muted/50 p-2 rounded-md">
                      <p className="text-sm font-medium">{item.field}</p>
                      <p className="text-sm mt-1">{item.value}</p>
                    </div>
                  ))}

                  {change.attachments && change.attachments.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Anexos adicionados:</p>
                      {change.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center p-2 border rounded-md">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.type} • {attachment.size}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}