// components/despesas/despesa-detail.tsx (REFACTORED AND CORRECTED - v2 - Continued)
"use client";

import React, { useState } from 'react'; // Import React
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Correct hook for App Router
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
// Correctly import AlertDialog components
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger // Import AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useDespesas } from '@/hooks/useDespesas';
// Correct import path for format utils
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, Edit, Trash2, FileText, CheckCircle, AlertTriangle, Info, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from 'next-auth/react';

// Define the expected type for the despesa object fetched by the hook
// (Adjust based on the actual return type of getDespesaById)
type DespesaDetails = {
    _id: string;
    description: string;
    value: number;
    date: string; // ISO string expected
    dueDate: string; // ISO string expected
    status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado';
    approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado';
    category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
    paymentMethod?: string | null;
    notes?: string | null;
    empreendimento: { _id: string; name: string } | null;
    createdBy?: { _id: string; name: string } | null;
    reviewedBy?: { _id: string; name: string } | null;
    reviewedAt?: string | null; // ISO string expected
    attachments?: Array<{ _id?: string; fileId?: string; name?: string; url?: string }>;
    createdAt: string; // ISO string expected
    updatedAt: string; // ISO string expected
};


export default function DespesaDetail({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Use the custom hook for despesas
  const {
    getDespesaById,
    deleteDespesa, // The action function
    approveDespesa, // The action function
    rejectDespesa, // The action function
    // Get the specific loading states from the hook
    isDeleting,
    isApproving,
    isRejecting,
  } = useDespesas();

  // Fetch despesa data using the query function from the hook
  const { data: despesa, isLoading: isLoadingDespesa, error: despesaError } = getDespesaById(id);
  // Use the typed despesa from the query result
  const typedDespesa: DespesaDetails | null | undefined = despesa ? {
    ...despesa,
    empreendimento: despesa.empreendimento ? {
      _id: despesa.empreendimento._id,
      name: String(despesa.empreendimento.name)
    } : null,
    createdBy: despesa.createdBy ? {
      _id: despesa.createdBy._id,
      name: String(despesa.createdBy.name)
    } : null,
    reviewedBy: despesa.reviewedBy ? {
      _id: despesa.reviewedBy._id,
      name: String(despesa.reviewedBy.name)
    } : null
  } : despesa;

  // --- RBAC Checks (use typedDespesa) ---
  const canEdit = typedDespesa && (
      session?.user?.role === 'admin' ||
      (session?.user?.role === 'user' && typedDespesa.approvalStatus === 'Pendente' && session.user.id === typedDespesa.createdBy?._id)
  );
  const canDelete = typedDespesa && (
       session?.user?.role === 'admin' ||
       (session?.user?.role === 'user' && typedDespesa.approvalStatus === 'Pendente' && session.user.id === typedDespesa.createdBy?._id)
   );
   const canReview = typedDespesa && (
       session?.user?.role === 'admin' // Only Admin can review via this button for now
       // || session?.user?.role === 'manager' // Uncomment if managers can also review
   );

  // --- Action Handlers using Action Functions ---
  const handleDelete = async () => {
    if (!id) return;
    try {
        await deleteDespesa(id); // Call the action function
        // Success toast is handled by the hook's onSuccess
        router.push('/dashboard/despesas');
        router.refresh();
    } catch (error: unknown) { // Catch potential errors from the action function
        console.error("Delete error in component:", error);
        // Error toast is handled by the hook's onError, but you could add more here
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
        await approveDespesa(id); // Call the action function
        // Success toast handled by hook
    } catch (error: unknown) {
        console.error("Approve error in component:", error);
        // Error toast handled by hook
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
        // Pass comments, even if empty, to match the expected input type
        await rejectDespesa(id, "Rejeitado via detalhes"); // Call the action function
        // Success toast handled by hook
    } catch (error: unknown) {
        console.error("Reject error in component:", error);
        // Error toast handled by hook
    }
  };

  // --- Render Loading State ---
  if (isLoadingDespesa) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-md flex-shrink-0" /><Skeleton className="h-6 w-48" /></div>
            <div className="flex gap-2"><Skeleton className="h-8 w-20 rounded-md" /><Skeleton className="h-8 w-20 rounded-md" /></div>
        </div>
        {/* Card Skeleton */}
        <Card><CardHeader className="pb-2"><div className="flex justify-between items-center"><Skeleton className="h-6 w-3/5" /><Skeleton className="h-5 w-20 rounded-full" /></div></CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={`skel-row1-${i}`} className="space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-2/3" /></div>)}
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[1, 2, 3].map(i => <div key={`skel-row2-${i}`} className="space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-2/3" /></div>)}
             </div>
             <Separator className="my-4 !mt-6 !mb-6" />
             <div className="space-y-1.5"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-10 w-full" /></div>
             <Separator className="my-4 !mt-6 !mb-6" />
             <div className="space-y-1.5"><Skeleton className="h-4 w-1/4" /><Skeleton className="h-16 w-full" /></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Render Error State ---
  if (despesaError) {
    return (
      <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-center">
        <AlertTriangle className="mx-auto h-8 w-8 mb-2"/>
        Erro ao carregar detalhes da despesa: {despesaError.message}
         <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Voltar</Button>
      </div>
    );
  }

  // --- Render Not Found State ---
  if (!typedDespesa) {
    return (
      <div className="text-center p-8 border rounded-md bg-muted/10">
        <p className="text-muted-foreground">Despesa não encontrada.</p>
         <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Voltar</Button>
      </div>
    );
  }

  // --- Render Despesa Details ---
  return (
    <TooltipProvider>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b pb-4">
            <div className="flex items-center gap-3 min-w-0">
                <Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0">
                    <Link href="/dashboard/despesas" aria-label="Voltar para lista de despesas"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                 {/* Ensure title is a string */}
                 <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={String(typedDespesa.description ?? '')}>{typedDespesa.description}</h1>
            </div>
          <div className="flex gap-2 flex-shrink-0">
             {canEdit && (
                 <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" size="sm" asChild className="h-8">
                        <Link href={`/dashboard/despesas/${id}/editar`}><Edit className="mr-1.5 h-3.5 w-3.5" /> Editar</Link>
                    </Button>
                 </TooltipTrigger><TooltipContent><p>Editar Despesa</p></TooltipContent></Tooltip>
             )}
             {canDelete && (
                 <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                   <Tooltip><TooltipTrigger asChild>
                      {/* Use AlertDialogTrigger */}
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="h-8" disabled={isDeleting}>
                              {/* Use isLoading from hook */}
                              {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                              Excluir
                           </Button>
                      </AlertDialogTrigger>
                   </TooltipTrigger><TooltipContent><p>Excluir Despesa</p></TooltipContent></Tooltip>
                   <AlertDialogContent>
                     <AlertDialogHeader><AlertDialogTitle>Tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente a despesa.</AlertDialogDescription></AlertDialogHeader>
                     <AlertDialogFooter className="gap-2 sm:gap-4 flex-col sm:flex-row">
                         {/* Use isLoading from hook */}
                         <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                         <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                             {/* Use isLoading from hook */}
                             {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
                         </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
             )}
          </div>
        </motion.div>

        {/* Main Details Card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-4 flex flex-row items-start justify-between gap-4">
               <div>
                  <CardTitle className="text-lg">Detalhes da Despesa</CardTitle>
                  <CardDescription>Informações gerais sobre o registro.</CardDescription>
               </div>
               <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {/* Use typedDespesa */}
                    <Badge variant={typedDespesa.status === 'Pago' ? 'default' : typedDespesa.status === 'A vencer' ? 'secondary' : 'destructive'} className={cn('text-xs', typedDespesa.status === 'Pago' && 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700')}>
                        {typedDespesa.status}
                    </Badge>
                     <Badge variant={typedDespesa.approvalStatus === 'Aprovado' ? 'default' : typedDespesa.approvalStatus === 'Rejeitado' ? 'destructive' : 'secondary'} className={cn('text-xs', typedDespesa.approvalStatus === 'Aprovado' && 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700')}>
                         {typedDespesa.approvalStatus}
                    </Badge>
               </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                {/* Use typedDespesa and format functions */}
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Valor</p><p className="text-lg font-semibold">{formatCurrency(typedDespesa.value)}</p></div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Categoria</p><p>{typedDespesa.category}</p></div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Empreendimento</p>
                    {/* Ensure title is string */}
                    <p className="truncate" title={String(typedDespesa.empreendimento?.name ?? 'N/A')}>{typedDespesa.empreendimento?.name ?? 'N/A'}</p>
                </div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Data</p><p>{formatDate(typedDespesa.date)}</p></div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Vencimento</p><p>{formatDate(typedDespesa.dueDate)}</p></div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Método Pag.</p><p>{typedDespesa.paymentMethod || 'N/A'}</p></div>
                <div className="space-y-1"><p className="font-medium text-muted-foreground">Criado por</p>
                    <p>{typedDespesa.createdBy?.name ?? 'N/A'}</p>
                </div>
                 <div className="space-y-1"><p className="font-medium text-muted-foreground">Criado em</p><p>{formatDateTime(typedDespesa.createdAt)}</p></div>
                 <div className="space-y-1"><p className="font-medium text-muted-foreground">Última Atualização</p><p>{formatDateTime(typedDespesa.updatedAt)}</p></div>
              </div>

               {/* Review Info */}
               {(typedDespesa.reviewedBy || typedDespesa.reviewedAt) && (
                   <>
                    <Separator />
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                         {typedDespesa.reviewedBy && <div className="space-y-1"><p className="font-medium text-muted-foreground">Revisado por</p><p>{typedDespesa.reviewedBy.name}</p></div>}
                         {typedDespesa.reviewedAt && <div className="space-y-1"><p className="font-medium text-muted-foreground">Revisado em</p>
                             {/* Safely format reviewedAt */}
                             <p>{typedDespesa.reviewedAt ? formatDateTime(typedDespesa.reviewedAt) : 'N/A'}</p>
                         </div>}
                     </div>
                   </>
               )}

              {/* Notes */}
              {typedDespesa.notes && (<><Separator /><div className="space-y-1"><p className="font-medium text-muted-foreground">Observações</p><p className="text-sm whitespace-pre-wrap">{typedDespesa.notes}</p></div></>)}

              {/* Attachments */}
              {typedDespesa.attachments && typedDespesa.attachments.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="font-medium text-muted-foreground">Anexos</p>
                    <ul className="space-y-2">
                      {typedDespesa.attachments.map((attachment) => (
                        <li key={attachment._id || attachment.fileId} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                           <div className="flex items-center gap-2 min-w-0">
                               <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                               {/* Ensure title is string */}
                               <span className="text-sm truncate" title={String(attachment.name ?? 'Anexo sem nome')}>{attachment.name || 'Anexo sem nome'}</span>
                           </div>
                           {attachment.url && (
                             <Tooltip>
                               <TooltipTrigger asChild>
                                 <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 flex-shrink-0" asChild>
                                   <a href={attachment.url} target="_blank" rel="noopener noreferrer" aria-label={`Ver anexo ${attachment.name ?? ''}`}>
                                     <LinkIcon className="h-4 w-4" />
                                   </a>
                                 </Button>
                               </TooltipTrigger>
                               <TooltipContent><p>Abrir anexo</p></TooltipContent>
                             </Tooltip>
                           )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

               {/* Review Actions */}
               {canReview && typedDespesa.approvalStatus === 'Pendente' && (
                  <>
                   <Separator />
                   <div className="space-y-3">
                       <p className="font-medium text-muted-foreground">Ações de Revisão</p>
                       <div className="flex flex-col sm:flex-row gap-3">
                             {/* Use isLoading states from the hook */}
                            <Button variant="outline" className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100 flex-1 sm:flex-none" onClick={handleApprove} disabled={isApproving || isRejecting}>
                                {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Aprovar
                           </Button>
                           <Button variant="outline" className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 flex-1 sm:flex-none" onClick={handleReject} disabled={isApproving || isRejecting}>
                                {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />} Rejeitar
                           </Button>
                       </div>
                   </div>
                  </>
               )}

            </CardContent>
          </Card>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}