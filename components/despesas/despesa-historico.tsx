// ============================================================
// START OF REFACTORED FILE: components/despesas/despesa-historico.tsx
// ============================================================
"use client";

import React, { useMemo } from 'react'; // Removido useState, useEffect
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, User, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// useToast não é mais necessário aqui, pois o hook lida com erros de fetch
// import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns"; // parseISO adicionado
import { ptBR } from "date-fns/locale";
import { useDespesas } from '@/hooks/useDespesas'; // *** IMPORT useDespesas ***
import { Loading } from '@/components/ui/loading'; // Import Loading component
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton for more granular loading

// Interface simplificada para anexo (baseada no uso atual)
interface Attachment {
  fileId?: string;
  name?: string;
  url?: string;
}

// Interface baseada no que é realmente usado pelo componente
// e retornado pelo useDespesas -> getDespesaById (despesaResponseSchema)
interface DespesaData {
  _id: string;
  description: string;
  value: number;
  status: string;
  empreendimento?: { // Pode ser opcional ou null
    name: string;
  };
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  createdBy?: { // Pode ser opcional ou null
      name: string;
  } | null;
  attachments?: Attachment[];
}

// Interface para entrada de histórico (sem alterações)
interface HistoryChange { field: string; value: string; }
interface HistoryEntry { id: string | number; date: string; user: string; action: string; changes: HistoryChange[]; attachments: { id?: string; name?: string; type?: string; size?: string; url?: string }[]; } // Adicionado URL opcional

// Função para gerar histórico (simplificada, MANTIDA COMO EXEMPLO)
// IDEALMENTE: O histórico viria do backend
const generateHistory = (despesa: DespesaData): HistoryEntry[] => {
  if (!despesa) return [];

  const history: HistoryEntry[] = [];

  // Criação
  history.push({
    id: `create-${despesa._id}`,
    date: format(parseISO(despesa.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    user: despesa.createdBy?.name || "Sistema",
    action: "Criação",
    changes: [
      { field: "Descrição", value: despesa.description },
      { field: "Valor", value: `R$ ${despesa.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }, // Format currency
      { field: "Status", value: despesa.status },
      { field: "Empreendimento", value: despesa.empreendimento?.name ?? 'N/A' }, // Safe access
    ],
    attachments: (despesa.attachments || []) // Add attachments from creation if available
      .filter(att => att.fileId && att.name)
      .map((att) => ({
        id: att.fileId,
        name: att.name,
        url: att.url,
        type: att.url?.split(".").pop()?.toUpperCase() || "UNK",
        size: "N/A",
      })),
  });

  // Atualização (simples, apenas verifica se updatedAt é diferente de createdAt)
  // Uma lógica real compararia snapshots ou usaria um log de auditoria
  if (despesa.updatedAt && despesa.createdAt !== despesa.updatedAt) {
    history.push({
      id: `update-${despesa._id}`,
      date: format(parseISO(despesa.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      user: "Sistema/Usuário", // Placeholder user
      action: "Atualização",
      changes: [ { field: "Dados", value: "Registro atualizado." }], // Generic change
       // Assume attachments could be linked to updates, though the current model doesn't track this well
      attachments: [], // Placeholder, real history needs better tracking
    });
  }

  // Sort by date just in case
  history.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  return history;
};


export default function DespesaHistorico({ id }: { id: string }) {
  // *** USE HOOK to fetch data ***
  const { getDespesaById } = useDespesas();
  const { data: despesa, isLoading, error } = getDespesaById(id);
  // const { toast } = useToast(); // Not needed if hook handles errors

  // Memoize the generated history based on fetched data
  const historicalChanges = useMemo(() => {
    return despesa ? generateHistory(despesa as DespesaData) : []; // Cast to DespesaData
  }, [despesa]);

  // --- Loading State ---
  if (isLoading) {
    // return <Loading />; // Simple full screen loading
    // Or use Skeleton for better UX
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2 border-b pb-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2 mt-1" />
          </CardHeader>
          <CardContent className="pl-9 ml-3">
            {/* Skeleton for timeline items */}
            {[1, 2].map(i => (
              <div key={i} className="mb-8 relative">
                <Skeleton className="absolute -left-9 mt-1.5 h-4 w-4 rounded-full" />
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-3 mt-3">
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-center">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2"/>
        Erro ao carregar histórico: {error.message}
         <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">Tentar Novamente</Button>
      </div>
    );
  }

  // --- Not Found State ---
   if (!despesa) {
     return (
        <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-200px)]">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Despesa Não Encontrada</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
               Não foi possível encontrar os dados para a despesa solicitada.
            </p>
             <Button variant="outline" asChild>
                 <Link href="/dashboard/despesas">
                     <ArrowLeft className="mr-2 h-4 w-4"/> Voltar para Lista
                 </Link>
             </Button>
        </div>
    );
   }


  // --- Render History ---
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <Button variant="outline" size="icon" asChild className="h-8 w-8">
          <Link href={`/dashboard/despesas/${id}`} aria-label="Voltar para Detalhes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Histórico da Despesa</h2>
          <p className="text-muted-foreground text-sm">{despesa.description}</p>
        </div>
      </div>

      {/* History Card */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alterações</CardTitle>
          <CardDescription>Alterações registradas para esta despesa.</CardDescription>
        </CardHeader>
        <CardContent>
          {historicalChanges.length > 0 ? (
            <div className="relative border-l-2 border-muted pl-6 ml-3">
              {historicalChanges.map((change, index) => (
                <div key={change.id} className={`mb-8 relative ${index === historicalChanges.length - 1 ? '' : 'pb-8'}`}>
                  {/* Timeline Dot */}
                  <div className="absolute -left-[30px] mt-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background ring-4 ring-background"></div>
                  {/* Content */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 mb-2">
                    <Badge variant={change.action === "Criação" ? "default" : "outline"} className="w-fit">{change.action}</Badge>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center"><Clock className="h-3 w-3 mr-1" />{change.date}</span>
                        <span className="flex items-center"><User className="h-3 w-3 mr-1" />{change.user}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3">
                    {change.changes.map((item, i) => (
                      <div key={i} className="bg-muted/30 p-3 rounded-md border border-border/50">
                        <p className="text-xs font-medium text-muted-foreground">{item.field}</p>
                        <p className="text-sm mt-1">{item.value}</p>
                      </div>
                    ))}

                    {change.attachments && change.attachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Anexos nesta alteração:</p>
                        <div className="space-y-1">
                            {change.attachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center p-2 border rounded-md text-sm bg-muted/30 border-border/50">
                                <FileText className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                                <span className="flex-1 truncate" title={attachment.name}>{attachment.name}</span>
                                {/* Optionally add link if URL is available */}
                                {attachment.url && (
                                    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline text-xs flex-shrink-0">Ver</a>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Nenhum histórico encontrado.</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
// ============================================================
// END OF REFACTORED FILE: components/despesas/despesa-historico.tsx
// ============================================================