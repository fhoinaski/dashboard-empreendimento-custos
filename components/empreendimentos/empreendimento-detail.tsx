"use client";

import { useState, useEffect } from "react";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// --- TYPE DEFINITIONS (Ideally move to types/index.ts and import) ---
interface ClientEmpreendimento {
    _id: string; name: string; address: string; type: string; status: string;
    totalUnits: number; soldUnits: number; startDate: string; // ISO String
    endDate: string; // ISO String
    description?: string; responsiblePerson: string; contactEmail: string; contactPhone: string;
    image?: string; folderId?: string; sheetId?: string;
    createdAt: string; // ISO String
    updatedAt: string; // ISO String
}
interface ClientDocument {
    _id: string; name: string; type: string; category?: string; fileId: string; url?: string; createdAt: string; // ISO String
}
interface ClientDespesa {
    _id: string; description: string; value: number; date: string; // ISO String (Added)
    dueDate: string; // ISO String
    status: string; updatedAt: string; // ISO String (Added)
}
interface TimelineEvent {
    id: string | number; title: string; date: Date; description: string; icon: React.ReactNode;
}
// --- END TYPE DEFINITIONS ---

export default function EmpreendimentoDetail({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [empreendimento, setEmpreendimento] = useState<ClientEmpreendimento | null>(null);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [expenses, setExpenses] = useState<ClientDespesa[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState<string | false>(false);
  const [isFetchingTabData, setIsFetchingTabData] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  // Initial Data Fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        const [empRes, docsRes, expRes] = await Promise.all([
          fetch(`/api/empreendimentos/${id}`, { cache: 'no-store'}),
          fetch(`/api/empreendimentos/${id}/documents`),
          fetch(`/api/despesas?empreendimento=${id}&limit=100`) // Fetch more expenses for the tab
        ]);

        if (!empRes.ok) {
            const errorData = await empRes.json().catch(() => ({}));
            throw new Error(errorData.error || "Falha ao carregar dados do empreendimento");
        }

        const empData = await empRes.json();
        const docsData = docsRes.ok ? await docsRes.json() : { documentos: [] };
        const expData = expRes.ok ? await expRes.json() : { despesas: [] };

        if (isMounted) {
            const fetchedEmpreendimento = empData.empreendimento as ClientEmpreendimento;
            const fetchedDocuments = docsData.documentos as ClientDocument[];
            const fetchedExpenses = (expData.despesas as ClientDespesa[]).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

            setEmpreendimento(fetchedEmpreendimento);
            setDocuments(fetchedDocuments);
            setExpenses(fetchedExpenses);
            generateTimeline(fetchedEmpreendimento, fetchedDocuments, fetchedExpenses);
        }

      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar dados:", error);
          toast({
            variant: "destructive",
            title: "Erro ao Carregar",
            description: error instanceof Error ? error.message : "Falha ao carregar detalhes. Tente novamente.",
          });
           if (!(error as Error).message.includes("documentos") && !(error as Error).message.includes("despesas")) {
                router.push("/dashboard/empreendimentos");
           }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchInitialData();
    return () => { isMounted = false };
  }, [id, toast, router]);

  // Timeline Generation
  const generateTimeline = (emp: ClientEmpreendimento | null, docs: ClientDocument[], exps: ClientDespesa[]) => {
      if (!emp) {
          setTimeline([]);
          return;
      }
       const events: TimelineEvent[] = [
        { id: `creation-${emp._id}`, title: "Criação do Empreendimento", date: new Date(emp.createdAt), description: "Registro inicial no sistema.", icon: <Plus className="h-3 w-3" /> },
        { id: `start-${emp._id}`, title: "Início Planejado", date: new Date(emp.startDate), description: "Data planejada para início.", icon: <Calendar className="h-3 w-3" /> },
        ...docs.slice(0, 3).map((doc) => ({
            id: `doc-${doc._id}`, title: `Doc Adicionado: ${doc.name}`, date: new Date(doc.createdAt), description: `Categoria: ${doc.category || 'Outros'}`, icon: <Upload className="h-3 w-3" />
        })),
        ...exps.filter(e => e.status === 'Pago').slice(0, 2).map((exp) => ({
            id: `exp-${exp._id}`, title: `Despesa Paga: ${exp.description}`, date: new Date(exp.updatedAt), // Use updatedAt
            description: `Valor: R$ ${exp.value.toFixed(2)}`, icon: <CheckCircle className="h-3 w-3" />
        })),
        { id: `end-${emp._id}`, title: "Conclusão Planejada", date: new Date(emp.endDate), description: "Data planejada para término.", icon: <Calendar className="h-3 w-3" /> },
    ];
       setTimeline(events.filter(e => !isNaN(e.date.getTime())).sort((a, b) => a.date.getTime() - b.date.getTime()));
  };

  // Action Handlers
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/empreendimentos/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha ao excluir empreendimento");
      }
      toast({ title: "Sucesso", description: "Empreendimento excluído!" });
      setDeleteDialogOpen(false);
      router.push("/dashboard/empreendimentos");
      router.refresh();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao excluir." });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadDocument = (doc: ClientDocument) => {
    if (doc?.url) {
      window.open(doc.url, "_blank");
      toast({ title: "Download iniciado", description: `Baixando ${doc.name}...` });
    } else {
      toast({ variant: "destructive", title: "Erro", description: "Link para download não encontrado." });
    }
  };

  const handleMarkAsPaid = async (expenseId: string) => {
    setIsMarkingPaid(expenseId);
    try {
      const formData = new FormData();
      formData.append("status", "Pago");
      const response = await fetch(`/api/despesas/${expenseId}`, { method: "PUT", body: formData });
      if (!response.ok) throw new Error("Falha ao atualizar despesa");
      const updatedData = await response.json();
      setExpenses((prev) =>
        prev.map((exp) => (exp._id === expenseId ? { ...exp, status: 'Pago', updatedAt: updatedData.despesa.updatedAt } : exp))
      );
      toast({ title: "Sucesso", description: "Despesa marcada como paga!" });
    } catch (error) {
      console.error("Erro ao marcar como pago:", error);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar como pago." });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleTabChange = (value: string) => setActiveTab(value);

  // Derived Data
  const progress = empreendimento && empreendimento.totalUnits > 0
                   ? Math.min(100, Math.round((empreendimento.soldUnits / empreendimento.totalUnits) * 100))
                   : 0;

  const documentsByCategory = documents.reduce((acc: Record<string, ClientDocument[]>, doc) => {
    const category = doc.category || "Outros";
    acc[category] = [...(acc[category] || []), doc];
    return acc;
  }, {});

  const expensesSummary = expenses.reduce((acc, e) => {
      acc.total += 1;
      acc.totalValue += e.value;
      if (e.status === "Pago") acc.paid += 1;
      else if (e.status === "Pendente" || e.status === "A vencer") acc.pending += 1;
      return acc;
  }, { total: 0, paid: 0, pending: 0, overdue: 0, totalValue: 0 });


  // --- Loading State UI ---
  if (isLoading) {
    return (
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

  // --- No Empreendimento Found UI ---
  if (!empreendimento) {
     return (
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
            <div className="flex items-center gap-3 min-w-0">
                <Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0">
                    <Link href="/dashboard/empreendimentos" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate" title={empreendimento.name}>
                        {empreendimento.name}
                    </h2>
                    <p className="text-muted-foreground flex items-center text-xs sm:text-sm truncate" title={empreendimento.address}>
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                        {empreendimento.address}
                    </p>
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
                        <DialogHeader>
                            <DialogTitle>Excluir Empreendimento</DialogTitle>
                            <DialogDescription>
                            Tem certeza? Todas as despesas e documentos associados também podem ser afetados. Esta ação é irreversível.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-4 flex-col sm:flex-row">
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting} className="w-full sm:w-auto">Cancelar</Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="w-full sm:w-auto">
                                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin"/>}
                                Excluir Permanentemente
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>

        {/* Image and Progress Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Detalhes do Projeto</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm"><p><strong className="text-muted-foreground w-24 inline-block">Tipo:</strong> {empreendimento.type}</p><p><strong className="text-muted-foreground w-24 inline-block">Status:</strong> {empreendimento.status}</p><p><strong className="text-muted-foreground w-24 inline-block">Início:</strong> {format(new Date(empreendimento.startDate), "dd/MM/yyyy", { locale: ptBR })}</p><p><strong className="text-muted-foreground w-24 inline-block">Conclusão:</strong> {format(new Date(empreendimento.endDate), "dd/MM/yyyy", { locale: ptBR })}</p><p className="flex"><strong className="text-muted-foreground w-24 inline-block flex-shrink-0">Descrição:</strong> <span className="inline-block">{empreendimento.description || "N/A"}</span></p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Contato Responsável</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm"><p><strong className="text-muted-foreground w-24 inline-block">Nome:</strong> {empreendimento.responsiblePerson}</p><p><strong className="text-muted-foreground w-24 inline-block">Email:</strong> {empreendimento.contactEmail}</p><p><strong className="text-muted-foreground w-24 inline-block">Telefone:</strong> {empreendimento.contactPhone}</p></CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4 mt-0">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"><CardTitle className="text-base sm:text-lg">Documentos</CardTitle><Button size="sm" variant="outline" asChild className="h-8 text-xs w-full sm:w-auto"><Link href={`/dashboard/documentos?empreendimento=${id}`}><Upload className="mr-1 h-3 w-3" /> Gerenciar Documentos</Link></Button></CardHeader>
                        <CardContent className="pb-3">{Object.keys(documentsByCategory).length > 0 ? (<Accordion type="single" collapsible className="w-full" defaultValue={Object.keys(documentsByCategory)[0]}>{Object.entries(documentsByCategory).map(([category, docs]) => (<AccordionItem key={category} value={category}><AccordionTrigger className="text-sm sm:text-base py-3 hover:no-underline"><div className="flex items-center justify-between w-full"><span className="font-medium">{category}</span><Badge variant="secondary" className="text-xs">{docs.length}</Badge></div></AccordionTrigger><AccordionContent className="pt-0 pb-2"><div className="border rounded-md overflow-hidden"><Table><TableHeader><TableRow><TableHead className="text-xs p-2 h-8">Nome</TableHead><TableHead className="text-xs p-2 h-8 hidden sm:table-cell">Data</TableHead><TableHead className="text-right text-xs p-2 h-8">Ações</TableHead></TableRow></TableHeader><TableBody>{docs.map((document) => (<TableRow key={document._id}><TableCell className="font-medium text-xs p-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"/><span className="truncate" title={document.name}>{document.name}</span></TableCell><TableCell className="text-xs p-2 hidden sm:table-cell">{format(new Date(document.createdAt), "dd/MM/yy")}</TableCell><TableCell className="text-right p-2"><div className="flex justify-end gap-0.5"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => handleDownloadDocument(document)} className="h-7 w-7 p-0"><Download className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent><p>Download</p></TooltipContent></Tooltip></div></TableCell></TableRow>))}</TableBody></Table></div></AccordionContent></AccordionItem>))}</Accordion>) : (<div className="text-center py-8 text-muted-foreground text-sm">Nenhum documento adicionado.</div>)}</CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4 mt-0">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2">
                            <CardTitle className="text-base sm:text-lg">Despesas Associadas</CardTitle>
                            <Button size="sm" variant="outline" asChild className="h-8 text-xs w-full sm:w-auto">
                                <Link href={`/dashboard/despesas/novo?empreendimento=${id}`}>
                                <Plus className="mr-1 h-3 w-3" /> Nova Despesa
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="pb-3 px-0 sm:px-3"> {/* Adjusted padding */}

                            {/* Mobile View: Cards */}
                            <div className="block sm:hidden px-3 space-y-3">
                                {expenses.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma despesa registrada.</div>
                                )}
                                {expenses.map((expense) => (
                                    <Card key={`mobile-${expense._id}`} className="shadow-sm">
                                        <CardContent className="p-3 space-y-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" title={expense.description}>{expense.description}</p>
                                                    <p className="text-sm font-semibold">R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vence: {format(new Date(expense.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <Badge
                                                        variant={expense.status === "Pago" ? "outline" : expense.status === "Pendente" ? "destructive" : "secondary"}
                                                        className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap",
                                                            expense.status === "Pago" && "border-green-500 text-green-700 bg-green-50",
                                                            expense.status === "Pendente" && "border-red-500 text-red-700 bg-red-50",
                                                            expense.status === "A vencer" && "border-amber-500 text-amber-700 bg-amber-50"
                                                        )}>
                                                        {expense.status}
                                                    </Badge>
                                                    <div className="flex gap-1 mt-1">
                                                        {expense.status !== "Pago" && (
                                                            <Button variant="outline" size="icon" onClick={() => handleMarkAsPaid(expense._id)} className="h-7 w-7" disabled={isMarkingPaid === expense._id} aria-label="Marcar como Pago">
                                                                {isMarkingPaid === expense._id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle className="h-3.5 w-3.5 text-green-600"/>}
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" asChild className="h-7 w-7">
                                                            <Link href={`/dashboard/despesas/${expense._id}`} aria-label="Ver Detalhes"><Eye className="h-3.5 w-3.5" /></Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop View: Table */}
                            <div className="hidden sm:block border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="h-8 px-2 text-xs">Descrição</TableHead>
                                        <TableHead className="h-8 px-2 text-xs text-right">Valor</TableHead>
                                        <TableHead className="h-8 px-2 text-xs text-center">Vencimento</TableHead>
                                        <TableHead className="h-8 px-2 text-xs text-center">Status</TableHead>
                                        <TableHead className="h-8 px-2 text-xs text-right">Ações</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {expenses.length === 0 && (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">Nenhuma despesa registrada.</TableCell></TableRow>
                                        )}
                                        {expenses.map((expense) => (
                                        <TableRow key={`desktop-${expense._id}`}>
                                            <TableCell className="font-medium text-xs p-2 truncate max-w-[150px] sm:max-w-xs" title={expense.description}>{expense.description}</TableCell>
                                            <TableCell className="text-xs p-2 text-right">R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-xs p-2 text-center">{format(new Date(expense.dueDate), "dd/MM/yy", { locale: ptBR })}</TableCell>
                                            <TableCell className="text-xs p-2 text-center">
                                                <Badge
                                                    variant={expense.status === "Pago" ? "outline" : expense.status === "Pendente" ? "destructive" : "secondary"}
                                                    className={cn("text-[10px] px-1.5 py-0.5 whitespace-nowrap",
                                                        expense.status === "Pago" && "border-green-500 text-green-700 bg-green-50",
                                                        expense.status === "Pendente" && "border-red-500 text-red-700 bg-red-50",
                                                        expense.status === "A vencer" && "border-amber-500 text-amber-700 bg-amber-50"
                                                    )}>{expense.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right p-1 sm:p-2">
                                                <div className="flex justify-end gap-0.5">
                                                    {expense.status !== "Pago" && (
                                                        <Tooltip><TooltipTrigger asChild>
                                                            <Button variant="ghost" size="sm" onClick={() => handleMarkAsPaid(expense._id)} className="h-7 w-7 p-0" disabled={isMarkingPaid === expense._id}>
                                                                {isMarkingPaid === expense._id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle className="h-3.5 w-3.5 text-green-600"/>}
                                                            </Button>
                                                        </TooltipTrigger><TooltipContent><p>Marcar como Pago</p></TooltipContent></Tooltip>
                                                    )}
                                                    <Tooltip><TooltipTrigger asChild>
                                                        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                                                            <Link href={`/dashboard/despesas/${expense._id}`}><Eye className="h-3.5 w-3.5" /></Link>
                                                        </Button>
                                                    </TooltipTrigger><TooltipContent><p>Ver Detalhes</p></TooltipContent></Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                         </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4 mt-0">
                    <Card>
                        <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Histórico do Projeto</CardTitle></CardHeader>
                        <CardContent className="pb-3 pl-5">
                            <div className="relative border-l-2 border-muted pl-6">
                                {timeline.length === 0 && <p className="text-muted-foreground text-sm py-4">Nenhum evento no histórico.</p>}
                                {timeline.map((event) => (
                                <div key={event.id} className="mb-6 relative before:absolute before:content-[''] before:w-4 before:h-4 before:rounded-full before:bg-background before:border-2 before:border-primary before:top-[5px] before:-left-[34px]">
                                    <div className="absolute text-primary -left-[33px] top-[5px] flex items-center justify-center w-4 h-4">{event.icon}</div>
                                    <time className="mb-1 text-xs font-normal leading-none text-muted-foreground">
                                        {format(event.date, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                                    </time>
                                    <h3 className="text-sm sm:text-base font-semibold">{event.title}</h3>
                                    <p className="text-xs sm:text-sm font-normal text-muted-foreground">{event.description}</p>
                                </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                </>
             
            </Tabs>
        </motion.div>
    </TooltipProvider>
  );
}