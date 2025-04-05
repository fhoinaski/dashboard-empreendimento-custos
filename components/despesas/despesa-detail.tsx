/* ================================== */
/* components/despesas/despesa-detail.tsx (RBAC Applied to Actions) */
/* ================================== */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Building, Receipt, CheckCircle, Download, Edit, Trash2, AlertTriangle, UserCheck, Clock, Info, ThumbsUp, ThumbsDown, Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added DialogClose
import { useToast } from "@/components/ui/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loading } from "@/components/ui/loading";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Interface definition (assuming it exists and includes necessary fields like approvalStatus, createdBy._id)
interface ClientDespesa {
    _id: string; description: string; value: number; date: string; dueDate: string;
    status: string; approvalStatus: string;
    category: string; notes?: string | null; paymentMethod?: string;
    empreendimento: { _id: string; name: string; };
    createdBy?: { _id: string; name: string; };
    reviewedBy?: { _id: string; name: string; };
    reviewedAt?: string;
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: string }>;
    createdAt: string; updatedAt: string;
}

export default function DespesaDetail({ id }: { id: string }) {
    const { data: session } = useSession();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [despesa, setDespesa] = useState<ClientDespesa | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | false>(false);

    const router = useRouter();
    const { toast } = useToast();

    // Determine user permissions based on session and despesa data
    const isAdmin = useMemo(() => session?.user?.role === 'admin', [session]);
    const isManager = useMemo(() => session?.user?.role === 'manager', [session]);
    const isCreator = useMemo(() => despesa?.createdBy?._id === session?.user?.id, [despesa, session]);
    const isPendingApproval = useMemo(() => despesa?.approvalStatus === 'Pendente', [despesa]);

    // Check if the current user can edit or delete this specific expense
    const canEditDelete = useMemo(() => {
        if (!session || !despesa) return false;
        if (isAdmin) return true; // Admin can always edit/delete
        // Creator (Manager or User) can edit/delete ONLY if it's still Pending Approval
        if (isCreator && isPendingApproval) return true;
        return false;
    }, [session, despesa, isAdmin, isCreator, isPendingApproval]);

    // Check if the current user can mark this expense as paid
    const canMarkPaid = useMemo(() => {
         if (!session || !despesa) return false;
         // Must be approved and not already paid/rejected
         if (despesa.approvalStatus !== 'Aprovado' || ['Pago', 'Rejeitado'].includes(despesa.status)) {
             return false;
         }
         // Admin or Manager can mark approved expenses as paid
         if (isAdmin || isManager) return true;
         // Creator cannot mark as paid (usually finance/manager responsibility)
         return false;
    }, [session, despesa, isAdmin, isManager]);

    // Check if the current user can review (approve/reject)
    const canReview = useMemo(() => {
        if (!session || !despesa) return false;
        // Only Admin can review, and only if it's pending
        return isAdmin && isPendingApproval;
    }, [session, despesa, isAdmin, isPendingApproval]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // API already performs RBAC check for viewing
            const response = await fetch(`/api/despesas/${id}`);
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({}));
                 if (response.status === 403) throw new Error("Acesso negado a esta despesa.");
                 if (response.status === 404) throw new Error("Despesa não encontrada.");
                 throw new Error(errorData.error || "Falha ao carregar despesa");
            }
            const data = await response.json();
            setDespesa(data.despesa);
        } catch (error) {
            console.error("Erro ao carregar despesa:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." });
            if (error instanceof Error && (error.message.includes("não encontrada") || error.message.includes("Acesso negado"))) {
                 router.push("/dashboard/despesas"); // Redirect if not found or forbidden
             }
        } finally {
            setIsLoading(false);
        }
    }, [id, toast, router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- Action Handlers ---
    const handleReview = useCallback(async (approvalStatus: 'Aprovado' | 'Rejeitado') => {
        if (!canReview) return; // Double-check permission
        setIsActionLoading(approvalStatus);
        try {
            // API endpoint /api/despesas/[id]/review is Admin-only
            const response = await fetch(`/api/despesas/${id}/review`, {
                method: "PUT", headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvalStatus }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Falha ao ${approvalStatus === 'Aprovado' ? 'aprovar' : 'rejeitar'}`);
            setDespesa(data.despesa);
            toast({ title: "Sucesso!", description: data.message });
            if (approvalStatus === 'Rejeitado') setRejectDialogOpen(false);
        } catch (error) { /* ... (error handling) ... */ toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." }); }
        finally { setIsActionLoading(false); }
    }, [id, toast, canReview]); // Added canReview dependency

    const handleDelete = async () => {
        if (!canEditDelete) return; // Double-check permission
        setIsActionLoading('delete');
        try {
            // API endpoint /api/despesas/[id] DELETE checks permissions
            const response = await fetch(`/api/despesas/${id}`, { method: "DELETE" });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Falha ao excluir"); }
            toast({ title: "Sucesso", description: "Despesa excluída!" });
            setDeleteDialogOpen(false);
            router.push("/dashboard/despesas");
            router.refresh();
        } catch (error) { /* ... (error handling) ... */ toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha." }); }
        finally { setIsActionLoading(false); }
    };

    const handleMarkAsPaid = async () => {
        if (!canMarkPaid) return; // Double-check permission
        setIsActionLoading('markPaid');
        try {
            const formData = new FormData();
            formData.append("status", "Pago");
            // API endpoint /api/despesas/[id] PUT checks permissions
            const response = await fetch(`/api/despesas/${id}`, { method: "PUT", body: formData });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Falha ao marcar como pago"); }
            const updatedData = await response.json();
            setDespesa(updatedData.despesa);
            toast({ title: "Sucesso", description: "Despesa marcada como paga!" });
        } catch (error) { /* ... (error handling) ... */ toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar como pago." }); }
        finally { setIsActionLoading(false); }
    };

    const handleDownloadAttachment = (url: string | undefined, name: string | undefined) => { /* ... (no changes) ... */ };

    // Badge styles (no changes needed)
    const getApprovalBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const variants = {
            Aprovado: 'outline',
            Rejeitado: 'destructive',
            Pendente: 'secondary'
        } as const;
        return variants[status as keyof typeof variants] || 'secondary';
    };
    const getApprovalBadgeStyle = (status: string) => { /* ... */ return { Aprovado: "border-green-500 text-green-700 bg-green-50", Rejeitado: "border-red-500 text-red-700 bg-red-50", Pendente: "border-amber-500 text-amber-700 bg-amber-50" }[status] || "border-gray-500 text-gray-700 bg-gray-50"; };
    const getFinancialBadgeStyle = (status: string) => { /* ... */ return { Pago: "border-green-500 text-green-700 bg-green-50", Pendente: "border-orange-500 text-orange-700 bg-orange-50", "A vencer": "border-amber-500 text-amber-700 bg-amber-50", Rejeitado: "border-red-500 text-red-700 bg-red-50" }[status] || "border-gray-500 text-gray-700 bg-gray-50"; };


    if (isLoading) return <Loading />;
    if (!despesa) return <div className="p-6 text-center text-muted-foreground">Despesa não encontrada ou acesso negado.</div>;

    return (
        <TooltipProvider>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 px-4 sm:px-6 lg:p-0">
             {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Left Side: Back Button, Title, Empreendimento */}
                <div className="flex items-center gap-2 min-w-0">
                     <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0"><Link href="/dashboard/despesas" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent><p>Voltar para Lista</p></TooltipContent></Tooltip>
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate" title={despesa.description}>{despesa.description}</h2>
                        <p className="text-muted-foreground flex items-center text-xs sm:text-sm truncate" title={despesa.empreendimento.name}><Building className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" /><Link href={`/dashboard/empreendimentos/${despesa.empreendimento._id}`} className="hover:underline">{despesa.empreendimento.name}</Link></p>
                    </div>
                </div>
                 {/* Right Side: Action Buttons based on permissions */}
                 <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                     {/* Review Actions (Admin Only, Pending Only) */}
                     {canReview && (
                         <>
                             <Button variant="outline" size="sm" onClick={() => handleReview('Aprovado')} disabled={!!isActionLoading} className="h-8 text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100">
                                 {isActionLoading === 'Aprovado' ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <ThumbsUp className="mr-1 h-3 w-3" />} Aprovar
                             </Button>
                              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                                <DialogTrigger asChild><Button variant="destructive" size="sm" disabled={!!isActionLoading} className="h-8 text-xs"><ThumbsDown className="mr-1 h-3 w-3" /> Rejeitar</Button></DialogTrigger>
                                  <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Rejeitar Despesa?</DialogTitle><DialogDescription>Esta ação definirá o status como 'Rejeitado'.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={() => handleReview('Rejeitado')} disabled={isActionLoading === 'Rejeitado'}>{isActionLoading === 'Rejeitado' ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : null} Confirmar Rejeição</Button></DialogFooter></DialogContent>
                             </Dialog>
                         </>
                     )}
                      {/* Mark as Paid Action */}
                     {canMarkPaid && (
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" onClick={handleMarkAsPaid} disabled={!!isActionLoading} className="h-8 text-xs">{isActionLoading === 'markPaid' ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <CheckCircle className="mr-1 h-3 w-3" />} Marcar Pago</Button></TooltipTrigger><TooltipContent><p>Marcar como pago</p></TooltipContent></Tooltip>
                     )}
                     {/* Edit & Delete Actions */}
                    {canEditDelete && (
                        <>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:bg-muted"><Link href={`/dashboard/despesas/${id}/editar`}><Edit className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent><p>Editar</p></TooltipContent></Tooltip>
                        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                            <Tooltip><TooltipTrigger asChild><DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-destructive" disabled={!!isActionLoading}><Trash2 className="h-4 w-4" /></Button></DialogTrigger></TooltipTrigger><TooltipContent><p>Excluir</p></TooltipContent></Tooltip>
                            <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir despesa?</DialogTitle><DialogDescription>Ação irreversível.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleDelete} disabled={isActionLoading === 'delete'}>{isActionLoading === 'delete' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Excluir</Button></DialogFooter></DialogContent>
                        </Dialog>
                        </>
                     )}
                 </div>
            </div>

             {/* Audit Info Banner */}
             {despesa.approvalStatus !== 'Pendente' && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("border rounded-lg p-3 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2", getApprovalBadgeStyle(despesa.approvalStatus))}>
                     <div className="flex items-center gap-2">
                        {despesa.approvalStatus === 'Aprovado' && <ThumbsUp className="h-4 w-4"/>}
                        {despesa.approvalStatus === 'Rejeitado' && <ThumbsDown className="h-4 w-4"/>}
                        <span className="font-semibold">Despesa {despesa.approvalStatus.toLowerCase()}</span>
                     </div>
                     {despesa.reviewedBy && despesa.reviewedAt && (
                         <span className="text-muted-foreground text-xs">por {despesa.reviewedBy.name} em {format(new Date(despesa.reviewedAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
                     )}
                 </motion.div>
             )}

             {/* Main Content Grid */}
             <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Details Card */}
                <Card className="md:col-span-2">
                    <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Detalhes</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                           <div><p className="text-muted-foreground text-xs">Valor</p><p className="font-medium text-base sm:text-lg">R$ {despesa.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                            <div><p className="text-muted-foreground text-xs">Status (Financeiro)</p><Badge variant={ despesa.status === "Pago" ? "outline" : despesa.status === "Pendente" || despesa.status === "A vencer" ? "secondary" : "destructive" } className={cn("mt-1 text-xs", getFinancialBadgeStyle(despesa.status))}>{despesa.status}</Badge></div>
                           <div><p className="text-muted-foreground text-xs">Categoria</p><p className="font-medium text-xs sm:text-sm">{despesa.category}</p></div>
                           <div><p className="text-muted-foreground text-xs">Data</p><p className="font-medium flex items-center text-xs sm:text-sm"><Calendar className="h-3 w-3 mr-1"/>{format(new Date(despesa.date), "dd/MM/yyyy", { locale: ptBR })}</p></div>
                           <div><p className="text-muted-foreground text-xs">Vencimento</p><p className="font-medium flex items-center text-xs sm:text-sm"><Calendar className="h-3 w-3 mr-1"/>{format(new Date(despesa.dueDate), "dd/MM/yyyy", { locale: ptBR })}</p></div>
                           <div><p className="text-muted-foreground text-xs">Pagamento</p><p className="font-medium text-xs sm:text-sm">{despesa.paymentMethod || "N/A"}</p></div>
                        </div>
                        <Separator />
                        <div><h3 className="text-base sm:text-lg font-medium mb-2">Observações</h3><p className="text-muted-foreground text-xs sm:text-sm">{despesa.notes || "Sem observações"}</p></div>
                        {/* Attachments */}
                        {despesa.attachments && despesa.attachments.length > 0 && (
                            <><Separator /><div><h3 className="text-base sm:text-lg font-medium mb-2">Anexo(s)</h3><div className="space-y-2">{despesa.attachments.map((att) => (<div key={att._id || att.fileId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-md gap-2"><div className="flex items-center gap-2 min-w-0"><Receipt className="h-4 w-4 mr-1 text-muted-foreground flex-shrink-0" /><p className="font-medium text-xs sm:text-sm truncate" title={att.name}>{att.name}</p></div><Button variant="ghost" size="sm" onClick={() => handleDownloadAttachment(att.url, att.name)} className="h-7 text-xs w-full sm:w-auto mt-1 sm:mt-0"><Download className="mr-1 h-3 w-3" />Download</Button></div>))}</div></div></>
                        )}
                    </CardContent>
                </Card>
                {/* Additional Info Card */}
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-base sm:text-lg">Informações</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><p className="text-muted-foreground text-xs">Status Aprovação</p><Badge variant={getApprovalBadgeVariant(despesa.approvalStatus)} className={cn("mt-1 text-xs", getApprovalBadgeStyle(despesa.approvalStatus))}>{despesa.approvalStatus}</Badge></div>
                        {despesa.reviewedBy && <div><p className="text-muted-foreground text-xs">Revisado por</p><p className="font-medium text-xs sm:text-sm">{despesa.reviewedBy.name}</p></div>}
                        {despesa.reviewedAt && <div><p className="text-muted-foreground text-xs">Data Revisão</p><p className="font-medium text-xs sm:text-sm">{format(new Date(despesa.reviewedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p></div>}
                        <div><p className="text-muted-foreground text-xs">Criado por</p><p className="font-medium text-xs sm:text-sm">{despesa.createdBy?.name || "Desconhecido"}</p></div>
                        <div><p className="text-muted-foreground text-xs">Data Criação</p><p className="font-medium text-xs sm:text-sm">{format(new Date(despesa.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p></div>
                        <div><p className="text-muted-foreground text-xs">Última Atualização</p><p className="font-medium text-xs sm:text-sm">{format(new Date(despesa.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p></div>
                        {/* History button can be added back when implemented */}
                        {/* <Separator /><Button variant="outline" className="w-full text-xs sm:text-sm" asChild disabled><span className="text-muted-foreground">Ver histórico (em breve)</span></Button> */}
                    </CardContent>
                </Card>
             </div>
        </motion.div>
        </TooltipProvider>
    );
}