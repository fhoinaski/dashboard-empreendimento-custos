"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  MapPin, Calendar, Edit, Trash2, ArrowLeft, Clock, CheckCircle, Upload, Download, Eye, Plus, FileText, DollarSign, Loader2, AlertTriangle, ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDespesas } from '@/hooks/useDespesas';
import { trpc } from '@/lib/trpc/client'; // Importar cliente tRPC
// import { useDocuments } from '@/hooks/useDocuments'; // Keep commented if not implemented

// --- TYPE DEFINITIONS ---
interface ClientEmpreendimento {
    _id: string; name: string; address: string; type: string; status: string;
    totalUnits: number; soldUnits: number; startDate: string;
    endDate: string; description?: string | null; responsiblePerson: string;
    contactEmail: string; contactPhone: string; image?: string | null;
    folderId?: string | null; sheetId?: string | null; createdAt: string;
    updatedAt: string; createdBy?: { _id: string; name: string; };
}
interface ClientDocument {
    _id: string; name: string; type: string; category?: string; fileId: string;
    url?: string | null; createdAt: string; updatedAt?: string;
    empreendimento: { _id: string; name: string; };
    createdBy?: { _id: string; name: string; } | null;
}
interface ClientDespesa {
    _id: string; description: string; value: number; date: string;
    dueDate: string; status: string; updatedAt: string;
    empreendimento: { _id: string; name: string; } | null;
}
interface TimelineEvent {
    id: string | number; title: string; date: Date; description: string; icon: React.ReactNode;
}
// --- END TYPE DEFINITIONS ---

export default function EmpreendimentoDetail({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Removed timeline state

  const router = useRouter();
  const { toast } = useToast();

  // --- Use tRPC Hooks ---
  const {
    getEmpreendimentoById,
    deleteEmpreendimento,
    isDeleting,
  } = useEmpreendimentos();

  const {
    updateFilters: updateDespesaFilters,
    despesas: expenses,
    isLoading: isLoadingExpenses,
    updateDespesa,
    isUpdating: isUpdatingDespesa,
  } = useDespesas();

  // Fetch Empreendimento Data
  const { data: empreendimento, isLoading: isLoadingEmpreendimento, error: empreendimentoError } = getEmpreendimentoById(id);

  // Fetch Documents Data usando tRPC diretamente
  const documentsQuery = trpc.documents.getAll.useQuery(
    { empreendimentoId: id, limit: 100, page: 1 },
    { enabled: !!id }
  );
  const documents = documentsQuery.data?.documents || [];
  const isLoadingDocuments = documentsQuery.isLoading;

  // Remover o useEffect que estava causando o erro
  // useEffect(() => {
  //     let isMounted = true;
  //     async function fetchDocs() {
  //         setIsLoadingDocuments(true);
  //         try {
  //             const res = await fetch(`/api/empreendimentos/${id}/documents`);
  //             if (!res.ok) throw new Error("Falha ao buscar documentos");
  //             const data = await res.json();
  //             if (isMounted) setDocuments(data.documentos || []);
  //         } catch (err) {
  //             if (isMounted) { console.error("Erro docs fetch:", err); toast({ variant: "destructive", title: "Erro Docs", description: "Não carregou." }); setDocuments([]); }
  //         } finally { if (isMounted) setIsLoadingDocuments(false); }
  //     }
  //     fetchDocs();
  //     return () => { isMounted = false };
  // }, [id, toast]);
  // End Document Fetch

  // Fetch Expenses Data
  useEffect(() => {
    updateDespesaFilters({ empreendimento: id, limit: 100, page: 1 });
  }, [id, updateDespesaFilters]);

  // --- Combined Loading State ---
  const isLoading = isLoadingEmpreendimento || isLoadingDocuments || isLoadingExpenses;

  // --- Calculate Timeline using useMemo ---
  const timeline = useMemo(() => {
    if (!empreendimento) {
        return []; // Return empty array if no empreendimento data
    }
    const events: TimelineEvent[] = [
      { id: `creation-${empreendimento._id}`, title: "Criação do Empreendimento", date: new Date(empreendimento.createdAt), description: "Registro inicial no sistema.", icon: <Plus className="h-3 w-3" /> },
      { id: `start-${empreendimento._id}`, title: "Início Planejado", date: new Date(empreendimento.startDate), description: "Data planejada para início.", icon: <Calendar className="h-3 w-3" /> },
      ...documents.slice(0, 3).map((doc) => ({
          id: `doc-${doc._id}`, title: `Doc Adicionado: ${doc.name}`, date: new Date(doc.createdAt), description: `Categoria: ${doc.category || 'Outros'}`, icon: <Upload className="h-3 w-3" />
      })),
      ...expenses.filter(e => e.status === 'Pago').slice(0, 2).map((exp) => ({
          id: `exp-${exp._id}`, title: `Despesa Paga: ${exp.description}`, date: new Date(exp.updatedAt), // Use updatedAt assuming it reflects payment date
          description: `Valor: R$ ${exp.value.toLocaleString('pt-BR',{minimumFractionDigits: 2})}`, icon: <CheckCircle className="h-3 w-3" />
      })),
      { id: `end-${empreendimento._id}`, title: "Conclusão Planejada", date: new Date(empreendimento.endDate), description: "Data planejada para término.", icon: <Calendar className="h-3 w-3" /> },
    ];
    // Filter out invalid dates and sort
    return events.filter(e => !isNaN(e.date.getTime())).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [empreendimento, documents, expenses]); // Recalculate only when dependencies change

  // --- Action Handlers (using useCallback) ---
  const handleDelete = useCallback(async () => {
    try {
      await deleteEmpreendimento(id);
      setDeleteDialogOpen(false);
      router.push("/dashboard/empreendimentos");
      router.refresh();
    } catch (error) { console.error("Erro ao excluir (component):", error); }
  }, [id, deleteEmpreendimento, router]);

  const handleMarkAsPaid = useCallback(async (expenseId: string) => {
    try {
        await updateDespesa(expenseId, { status: 'Pago' });
    } catch (error) { console.error("Erro ao marcar como pago (component):", error); }
  }, [updateDespesa]);

  // --- Other Handlers (Keep) ---
  const handleDownloadDocument = (doc: ClientDocument) => {
    if (doc?.url) { window.open(doc.url, "_blank"); toast({ title: "Download iniciado", description: `Baixando ${doc.name}...` }); }
    else { toast({ variant: "destructive", title: "Erro", description: "Link para download não encontrado." }); }
  };
  const handleTabChange = (value: string) => setActiveTab(value);

  // --- Derived Data (Keep) ---
  const progress = empreendimento && empreendimento.totalUnits > 0
                   ? Math.min(100, Math.round((empreendimento.soldUnits / empreendimento.totalUnits) * 100))
                   : 0;
  const documentsByCategory = documents.reduce((acc: Record<string, ClientDocument[]>, doc: ClientDocument) => {
    const category = doc.category || "Outros";
    acc[category] = [...(acc[category] || []), doc];
    return acc;
  }, {} as Record<string, ClientDocument[]>);
  const expensesSummary = expenses.reduce((acc, e) => {
      acc.total += 1;
      acc.totalValue += e.value;
      if (e.status === "Pago") acc.paid += 1;
      else if (e.status === "Pendente" || e.status === "A vencer") acc.pending += 1;
      return acc;
  }, { total: 0, paid: 0, pending: 0, overdue: 0, totalValue: 0 });


  // --- Loading State UI ---
  if (isLoading) {
    return ( /* Skeleton remains the same */
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="flex items-center gap-4 border-b pb-4">
          <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
          <div className="space-y-2 flex-grow"><Skeleton className="h-6 w-4/5 sm:w-1/2" /><Skeleton className="h-4 w-full sm:w-3/4" /></div>
          <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" /><Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4"><Skeleton className="aspect-[16/9] w-full rounded-lg" /></div>
          <div className="space-y-4"><Skeleton className="h-48 w-full rounded-lg" /></div>
        </div>
        <Skeleton className="h-10 w-full rounded-md" /><Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // --- Error State UI ---
   if (empreendimentoError) {
     return ( /* Error UI remains the same */
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center text-destructive">
             <AlertTriangle className="mx-auto h-16 w-16 mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Erro ao Carregar</h2>
            <p className="mb-8 max-w-md">{empreendimentoError.message || "Não foi possível carregar os detalhes do empreendimento."}</p>
             <Button variant="outline" asChild>
                <Link href="/dashboard/empreendimentos">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Voltar para a Lista
                </Link>
            </Button>
        </div>
     );
   }

  // --- No Empreendimento Found UI ---
  if (!empreendimento) {
     return ( /* No Empreendimento UI remains the same */
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
             <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Empreendimento Não Encontrado</h2>
            <p className="text-muted-foreground mb-8 max-w-md">O empreendimento que você está procurando não existe ou foi removido.</p>
             <Button variant="outline" asChild>
                <Link href="/dashboard/empreendimentos">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Voltar para a Lista
                </Link>
            </Button>
        </div>
    );
  }

  // --- Render Details ---
  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
            {/* Header content remains the same, uses `isDeleting` from hook */}
            <div className="flex items-center gap-3 min-w-0">
                <Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0">
                    <Link href="/dashboard/empreendimentos" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate" title={empreendimento.name}>{empreendimento.name}</h2>
                    <p className="text-muted-foreground flex items-center text-xs sm:text-sm truncate" title={empreendimento.address}><MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />{empreendimento.address}</p>
                </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
                <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" size="icon" asChild className="h-8 w-8">
                        <Link href={`/dashboard/empreendimentos/${id}/editar`}><Edit className="h-4 w-4" /></Link>
                    </Button>
                </TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <Tooltip><TooltipTrigger asChild>
                        <DialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-8 w-8" disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                        </DialogTrigger></TooltipTrigger><TooltipContent><p>Excluir</p></TooltipContent></Tooltip>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Excluir Empreendimento</DialogTitle><DialogDescription>Tem certeza? Todas as despesas e documentos associados também podem ser afetados. Esta ação é irreversível.</DialogDescription></DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-4 flex-col sm:flex-row">
                            <DialogClose asChild><Button variant="outline" disabled={isDeleting} className="w-full sm:w-auto">Cancelar</Button></DialogClose>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="w-full sm:w-auto">{isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}Excluir Permanentemente</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>

        {/* Image and Progress Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Content remains the same, uses `empreendimento`, `progress`, `expensesSummary`, `documents` */}
             <Card className="md:col-span-2 overflow-hidden">
                <div className="relative aspect-[16/9] sm:aspect-[2/1] w-full bg-muted">
                    <img src={empreendimento.image || "/placeholder.svg?height=400&width=800"} alt={empreendimento.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.src = "/placeholder.svg?height=400&width=800"; }} loading="lazy"/>
                    <div className="absolute top-2 right-2">
                        <Badge variant={empreendimento.status === "Concluído" ? "outline" : empreendimento.status === "Planejamento" ? "secondary" : "default"} className={cn("text-xs", empreendimento.status === "Concluído" && "bg-green-100 text-green-800 border-green-300", empreendimento.status === "Em andamento" && "bg-blue-100 text-blue-800 border-blue-300", empreendimento.status === "Planejamento" && "bg-gray-100 text-gray-800 border-gray-300")}>
                            {empreendimento.status}
                        </Badge>
                    </div>
                </div>
            </Card>
            <Card className="flex flex-col">
                <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Progresso Geral</CardTitle></CardHeader>
                <CardContent className="space-y-4 flex-grow">
                    <div>
                        <div className="flex items-center justify-between mb-1 text-sm"><span className="font-medium">Unidades Vendidas</span><span className="text-muted-foreground">{empreendimento.soldUnits}/{empreendimento.totalUnits}</span></div>
                        <Progress value={progress} className="h-2" aria-label={`${progress}% de unidades vendidas`} />
                        <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
                    </div>
                    <div className="space-y-1"><h4 className="text-sm font-medium">Despesas</h4><div className="flex justify-between text-sm"><span className="text-muted-foreground">Pagas:</span><span className="font-medium text-green-600">{expensesSummary.paid}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Pendentes:</span><span className="font-medium text-amber-600">{expensesSummary.pending}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Gasto:</span><span className="font-medium">R$ {expensesSummary.totalValue.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits: 2})}</span></div></div>
                    <div className="space-y-1"><h4 className="text-sm font-medium">Documentos</h4><div className="flex justify-between text-sm"><span className="text-muted-foreground">Total:</span><span className="font-medium">{documents.length}</span></div></div>
                </CardContent>
                <CardFooter className="border-t p-3 text-xs text-muted-foreground"><Clock className="h-3 w-3 mr-1.5" />Atualizado {formatDistanceToNow(new Date(empreendimento.updatedAt), { locale: ptBR, addSuffix: true })}</CardFooter>
            </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs sm:text-sm">Documentos</TabsTrigger>
                <TabsTrigger value="expenses" className="text-xs sm:text-sm">Despesas ({expenses.length})</TabsTrigger>
                <TabsTrigger value="timeline" className="text-xs sm:text-sm">Histórico</TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <>
                <TabsContent value="overview" className="space-y-4 mt-0">
                    {/* Overview content remains the same */}
                    <Card><CardHeader><CardTitle className="text-lg">Detalhes do Projeto</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><strong className="text-muted-foreground w-24 inline-block">Tipo:</strong> {empreendimento.type}</p><p><strong className="text-muted-foreground w-24 inline-block">Status:</strong> {empreendimento.status}</p><p><strong className="text-muted-foreground w-24 inline-block">Início:</strong> {format(parseISO(empreendimento.startDate), "dd/MM/yyyy", { locale: ptBR })}</p><p><strong className="text-muted-foreground w-24 inline-block">Conclusão:</strong> {format(parseISO(empreendimento.endDate), "dd/MM/yyyy", { locale: ptBR })}</p><p className="flex"><strong className="text-muted-foreground w-24 inline-block flex-shrink-0">Descrição:</strong> <span className="inline-block">{empreendimento.description || "N/A"}</span></p></CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-lg">Contato Responsável</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><strong className="text-muted-foreground w-24 inline-block">Nome:</strong> {empreendimento.responsiblePerson}</p><p><strong className="text-muted-foreground w-24 inline-block">Email:</strong> {empreendimento.contactEmail}</p><p><strong className="text-muted-foreground w-24 inline-block">Telefone:</strong> {empreendimento.contactPhone}</p></CardContent></Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4 mt-0">
                     {/* Documents content remains the same, uses `documents` state */}
                     <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"><CardTitle className="text-base sm:text-lg">Documentos</CardTitle><Button size="sm" variant="outline" asChild className="h-8 text-xs w-full sm:w-auto"><Link href={`/dashboard/documentos/novo?empreendimento=${id}`}><Plus className="mr-1 h-3 w-3" />Adicionar</Link></Button></CardHeader>
                        <CardContent className="pb-3">
                              {isLoadingDocuments ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>) : documents.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2" /><p>Nenhum documento encontrado</p><p className="text-xs">Adicione documentos para este empreendimento</p></div>) : (<Accordion type="multiple" className="w-full" defaultValue={Object.keys(documentsByCategory).map(cat => cat)}>{Object.entries(documentsByCategory).map(([category, docs]) => (<AccordionItem key={category} value={category}><AccordionTrigger className="text-sm font-medium">{category} <Badge variant="outline" className="ml-2 text-xs">{Array.isArray(docs) ? docs.length : 0}</Badge></AccordionTrigger><AccordionContent><div className="space-y-2">{Array.isArray(docs) && docs.map((document: ClientDocument) => (<div key={document._id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-sm"><div className="flex items-center gap-2 min-w-0"><FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" /><span className="truncate">{document.name}</span></div><div className="flex gap-1"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadDocument(document)}><Download className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent><p>Download</p></TooltipContent></Tooltip></TooltipProvider></div></div>))}</div></AccordionContent></AccordionItem>))}</Accordion>)}
                          </CardContent>
                      </Card>
                  </TabsContent>

                  <TabsContent value="expenses" className="space-y-4 mt-0">
                      {/* Expenses content remains the same */}
                      <Card>
                          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"><CardTitle className="text-base sm:text-lg">Despesas</CardTitle><Button size="sm" variant="outline" asChild className="h-8 text-xs w-full sm:w-auto"><Link href={`/dashboard/despesas/novo?empreendimento=${id}`}><Plus className="mr-1 h-3 w-3" />Adicionar</Link></Button></CardHeader>
                          <CardContent className="pb-3">
                              {isLoadingExpenses ? (<div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>) : expenses.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><DollarSign className="h-8 w-8 mx-auto mb-2" /><p>Nenhuma despesa encontrada</p><p className="text-xs">Adicione despesas para este empreendimento</p></div>) : (<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs px-2">Descrição</TableHead><TableHead className="text-xs px-2 hidden sm:table-cell">Valor</TableHead><TableHead className="text-xs px-2 hidden sm:table-cell">Vencimento</TableHead><TableHead className="text-xs px-2 hidden sm:table-cell">Status</TableHead><TableHead className="text-right text-xs px-2">Ações</TableHead></TableRow></TableHeader><TableBody>{expenses.slice(0, 5).map((expense) => (<TableRow key={expense._id}><TableCell className="font-medium text-xs px-2">{expense.description}<div className="sm:hidden text-muted-foreground text-xs">R$ {expense.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})} • {format(new Date(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })} • {expense.status}</div></TableCell><TableCell className="text-xs px-2 hidden sm:table-cell">R$ {expense.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell><TableCell className="text-xs px-2 hidden sm:table-cell">{format(new Date(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })}</TableCell><TableCell className="text-xs px-2 hidden sm:table-cell"><Badge variant={expense.status === "Pago" ? "outline" : expense.status === "Pendente" ? "secondary" : "destructive"} className={cn("text-xs", expense.status === "Pago" && "bg-green-100 text-green-800 border-green-300", expense.status === "Pendente" && "bg-amber-100 text-amber-800 border-amber-300", (expense.status === "A vencer" || expense.status === "Rejeitado") && "bg-red-100 text-red-800 border-red-300")}>{expense.status}</Badge></TableCell><TableCell className="text-right px-2"><div className="flex items-center justify-end gap-1"><TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" asChild><Link href={`/dashboard/despesas/${expense._id}`}><Eye className="h-3.5 w-3.5" /></Link></Button></TooltipTrigger><TooltipContent><p>Ver</p></TooltipContent></Tooltip></TooltipProvider>{expense.status !== "Pago" && (<TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkAsPaid(expense._id)} disabled={isUpdatingDespesa}>{isUpdatingDespesa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}</Button></TooltipTrigger><TooltipContent><p>Marcar como pago</p></TooltipContent></Tooltip></TooltipProvider>)}</div></TableCell></TableRow>))}</TableBody></Table></div>)}
                              {expenses.length > 5 && (<div className="mt-4 text-center"><Button variant="link" size="sm" asChild><Link href={`/dashboard/empreendimentos/${id}/despesas`}>Ver todas as despesas</Link></Button></div>)}
                          </CardContent>
                      </Card>
                  </TabsContent>

                  <TabsContent value="timeline" className="space-y-4 mt-0">
                      {/* Timeline content remains the same */}
                      <Card>
                          <CardHeader><CardTitle className="text-lg">Linha do Tempo</CardTitle></CardHeader>
                          <CardContent>
                              {timeline.length === 0 ? (<div className="text-center py-8 text-muted-foreground"><Clock className="h-8 w-8 mx-auto mb-2" /><p>Nenhum evento registrado</p></div>) : (<div className="relative pl-6 border-l">                                  {timeline.map((event, index) => (<div key={event.id} className="mb-6 last:mb-0"><div className="absolute left-0 transform -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">{event.icon}</div><div className="text-sm"><p className="font-medium">{event.title}</p><p className="text-muted-foreground text-xs">{format(event.date, "dd/MM/yyyy", { locale: ptBR })}</p><p className="mt-1 text-xs">{event.description}</p></div></div>))}</div>)}
                          </CardContent>
                      </Card>
                  </TabsContent>
              </>
          </Tabs>
      </motion.div>
    </TooltipProvider>
  );
}