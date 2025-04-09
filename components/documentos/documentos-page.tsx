// components/documentos/documentos-page.tsx
// CORRIGIDO (Erro Children.only na tabela + Tipos Upload)
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2, Download, Eye, Trash2, FolderOpen, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import type { ClientDocument, ClientEmpreendimento } from "@/lib/trpc/types";

interface EmpreendimentoOption { _id: string; name: string; folderId?: string | null; }

const DocumentsSkeleton = () => ( /* Skeleton JSX (sem alterações) */
    <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4"><div className="space-y-1.5"><Skeleton className="h-6 w-32 rounded-md" /><Skeleton className="h-4 w-56 rounded-md" /></div></div>
        <Card><CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader><CardContent className="p-6 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div><Skeleton className="h-40 w-full rounded-lg" /><div className="flex justify-end"><Skeleton className="h-10 w-32 rounded-md" /></div></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full rounded-lg" /></CardContent></Card>
    </div>
);

export default function DocumentosPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useContext();

  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("todos");
  const [category, setCategory] = useState<string>("Outros");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const isAdminOrManager = useMemo(() => session?.user?.role === 'admin' || session?.user?.role === 'manager', [session]);

  const { empreendimentos: empreendimentoList, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();
  const empreendimentoOptions = useMemo((): EmpreendimentoOption[] => (empreendimentoList || []).map((emp: ClientEmpreendimento) => ({ _id: emp._id, name: emp.name, folderId: emp.folderId })), [empreendimentoList]);
  const documentsQuery = trpc.documents.getAll.useQuery( { empreendimentoId: selectedEmpreendimentoId !== 'todos' ? selectedEmpreendimentoId : undefined, limit: 100, page: 1, }, { enabled: !!isAdminOrManager, staleTime: 5 * 60 * 1000 } );

  const isFetchingFilters = isLoadingEmpreendimentos;
  const isFetchingDocs = documentsQuery.isLoading || documentsQuery.isFetching;
  // isUploading é controlado manualmente pela chamada fetch

  const handleUpload = useCallback(async () => {
    if (!isAdminOrManager || selectedEmpreendimentoId === 'todos' || files.length === 0) { /* ... validações ... */ return; }
    const selectedEmp = empreendimentoOptions.find(emp => emp._id === selectedEmpreendimentoId);
    if (!selectedEmp?.folderId) { toast({ variant: "destructive", title: "Erro Configuração", description: `Pasta Drive não encontrada para "${selectedEmp?.name}". Crie-a na pág. do emp.` }); return; }

    setIsUploading(true);
    let filesProcessed = 0, uploadErrors = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('empreendimentoId', selectedEmpreendimentoId);
        formData.append('category', category || 'Outros');

        const response = await fetch('/api/upload-drive-document', { method: 'POST', body: formData });
        const result = await response.json();

        if (!response.ok || !result.success) { throw new Error(result.error || `Falha (Status: ${response.status})`); }
        filesProcessed++;

      } catch (error) {
        console.error(`[handleUpload] Erro fetch ${file.name}:`, error);
        uploadErrors++;
        toast({ variant: "destructive", title: `Erro Upload (${file.name})`, description: error instanceof Error ? error.message : "Falha." });
      }
    } // Fim loop

    setIsUploading(false);
    if (filesProcessed > 0) { toast({ title: "Upload Concluído", description: `${filesProcessed} arquivo(s) processado(s). ${uploadErrors > 0 ? `${uploadErrors} falharam.` : ''}` }); utils.documents.getAll.invalidate({ empreendimentoId: selectedEmpreendimentoId }); }
    setFiles([]);

  }, [isAdminOrManager, files, selectedEmpreendimentoId, category, toast, empreendimentoOptions, utils]);


  const handleOpenDocument = useCallback(async (doc: ClientDocument) => { /* ... */ if (!doc.url) { toast({ variant: "destructive", title: "Erro", description: "Link indisponível." }); return; } try { window.open(doc.url, '_blank', 'noopener,noreferrer'); } catch (error) { console.error("Erro abrir doc:", error); toast({ variant: "destructive", title: "Erro Abrir", description: "Não foi possível." }); } }, [toast]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ if (e.target.files) { const newFiles = Array.from(e.target.files); if (files.length + newFiles.length > 5) { toast({ variant: "default", title: "Limite", description: "Máx 5." }); return; } const validFiles = newFiles.filter(file => { if (file.size > 15 * 1024 * 1024) { toast({ variant: "default", title: "Grande", description: `${file.name} > 15MB.` }); return false; } return true; }); setFiles(prev => [...prev, ...validFiles]); e.target.value = ''; } };
  const removeFile = (index: number) => { /* ... */ setFiles(prev => prev.filter((_, i) => i !== index)); };

  if (sessionStatus === 'loading') { return <DocumentsSkeleton />; }
  if (!isAdminOrManager && sessionStatus === 'authenticated') { return ( <div className="p-6 border ..."><Lock/> ... </div> ); }
  if (sessionStatus === 'unauthenticated') { return <div className="p-6 ...">Faça login...</div>; }
  const showSkeleton = isFetchingFilters || (selectedEmpreendimentoId !== 'todos' && isFetchingDocs);
  if (showSkeleton && documentsQuery.data?.documents.length === 0) { return <DocumentsSkeleton />; }
  const selectedEmpHasFolder = selectedEmpreendimentoId !== 'todos' && !!empreendimentoOptions.find(e => e._id === selectedEmpreendimentoId)?.folderId;

  return (
    <TooltipProvider>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
       <div className="border-b pb-4"> <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Documentos</h2> <p className="text-muted-foreground text-sm">Upload e visualize documentos por empreendimento via Google Drive.</p> </div>

      {/* Upload Card */}
       <Card>
         <CardHeader> <CardTitle>Upload de Novos Documentos</CardTitle> <CardDescription>Selecione o empreendimento, categoria e os arquivos para enviar para o Google Drive.</CardDescription> </CardHeader>
         <CardContent className="p-6 space-y-6">
           {/* Filters */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label htmlFor="empreendimento-select" className="block text-sm font-medium mb-1">Empreendimento *</label>
               <Select value={selectedEmpreendimentoId} onValueChange={setSelectedEmpreendimentoId} disabled={isUploading || isFetchingFilters}>
                 <SelectTrigger id="empreendimento-select" className={cn(isFetchingFilters && "text-muted-foreground")}> <SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Selecione..."} /> </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="todos" disabled>Selecione um Empreendimento</SelectItem>
                   {empreendimentoOptions.length === 0 && !isFetchingFilters ? ( <div className="p-4 text-sm text-muted-foreground text-center">Nenhum emp. encontrado.</div> )
                    : ( empreendimentoOptions.map((emp) => ( <SelectItem key={emp._id} value={emp._id} disabled={!emp.folderId} title={!emp.folderId ? "Setup Drive Pendente" : ""}> {emp.name} {!emp.folderId && "(Setup Pendente)"} </SelectItem> )) )}
                 </SelectContent>
               </Select>
               {!isFetchingFilters && empreendimentoOptions.length === 0 && ( <p className="text-xs text-muted-foreground mt-1">Crie um emp. primeiro.</p> )}
               {selectedEmpreendimentoId !== 'todos' && !selectedEmpHasFolder && !isFetchingFilters && ( <p className="text-xs text-destructive mt-1 flex items-center gap-1"> <AlertCircle className="h-3 w-3"/> Setup Drive pendente na <Link href={`/dashboard/empreendimentos/${selectedEmpreendimentoId}`} className="underline hover:text-destructive/80">pág. do emp</Link>. </p> )}
             </div>
             <div>
               <label htmlFor="category-select" className="block text-sm font-medium mb-1">Categoria</label>
               <Select value={category} onValueChange={setCategory} disabled={isUploading}>
                 <SelectTrigger id="category-select"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                 <SelectContent>
                    <SelectItem value="Documentos Jurídicos">Documentos Jurídicos</SelectItem>
                    <SelectItem value="Plantas e Projetos">Plantas e Projetos</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Contratos">Contratos</SelectItem>
                    <SelectItem value="Fotos">Fotos</SelectItem>
                    <SelectItem value="Relatórios">Relatórios</SelectItem>
                    <SelectItem value="Despesas">Comprovantes Despesas</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
           {/* File Dropzone */}
           <div>
                <label htmlFor="file-upload" className="block text-sm font-medium mb-1">Arquivos *</label>
                <Card className={cn("border-dashed border-2 hover:border-primary transition-colors", files.length > 0 && "border-solid border-primary/50")}>
                    <CardContent className="p-4">
                        <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer rounded-md", isUploading || selectedEmpreendimentoId === 'todos' || !selectedEmpHasFolder ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50")}>
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-primary font-medium">Clique para selecionar ou arraste</span>
                            <span className="text-xs text-muted-foreground mt-1">Máximo 5 arquivos, 15MB cada</span> {/* Ajustado limite para 15MB */}
                            <Input id="file-upload" type="file" className="hidden" multiple onChange={handleFileChange} disabled={isUploading || selectedEmpreendimentoId === 'todos' || !selectedEmpHasFolder} />
                        </label>
                        {files.length > 0 && ( /* Lista de arquivos selecionados */
                            <div className="mt-4 space-y-2"> <p className="text-xs font-medium text-muted-foreground">Selecionados:</p> {files.map((file, index) => ( <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/30 text-sm"> <div className="flex items-center gap-2 min-w-0"> <FileText className="h-4 w-4 flex-shrink-0" /> <span className="truncate" title={file.name}>{file.name}</span> <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span> </div> <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFile(index)} disabled={isUploading}> <X className="h-4 w-4" /><span className="sr-only">Remover</span> </Button> </div> ))} </div>
                        )}
                    </CardContent>
                </Card>
           </div>
           {/* Botão Upload */}
           <div className="flex justify-end">
               <Button onClick={handleUpload} disabled={isUploading || selectedEmpreendimentoId === 'todos' || files.length === 0 || !selectedEmpHasFolder}>
                   {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                   {isUploading ? "Enviando..." : `Enviar ${files.length > 0 ? files.length : ''} Arquivo(s)`}
               </Button>
           </div>
         </CardContent>
       </Card>

       {/* Lista de Documentos */}
       {selectedEmpreendimentoId !== 'todos' && (
           <Card>
               <CardHeader><CardTitle>Documentos de: {empreendimentoOptions.find(e => e._id === selectedEmpreendimentoId)?.name ?? '...'}</CardTitle><CardDescription>Arquivos armazenados no Google Drive.</CardDescription></CardHeader>
                <CardContent>
                     {isFetchingDocs && documentsQuery.data?.documents.length === 0 ? ( <Skeleton className="h-40 w-full rounded-lg" /> )
                      : !documentsQuery.data?.documents || documentsQuery.data.documents.length === 0 ? (
                         <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center"> <FolderOpen className="h-10 w-10 mb-3 opacity-50"/> Nenhum documento encontrado.</div>
                      ) : (
                         <div className="border rounded-md overflow-hidden">
                             <Table>
                                 <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="hidden md:table-cell">Categoria</TableHead><TableHead className="hidden sm:table-cell">Data Upload</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                                 <TableBody>
                                     {documentsQuery.data.documents.map((doc) => (
                                         <TableRow key={doc._id}>
                                             <TableCell className="font-medium text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground flex-shrink-0"/><span className="truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={doc.name}>{doc.name}</span></TableCell>
                                             <TableCell className="text-xs hidden md:table-cell">{doc.category || 'Outros'}</TableCell>
                                             <TableCell className="text-xs hidden sm:table-cell">{format(parseISO(doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                                             <TableCell className="text-right">
                                                  <Tooltip>
                                                    {/* ===== CORREÇÃO TooltipTrigger na Tabela ===== */}
                                                    <TooltipTrigger>
                                                        <Button variant="ghost" size="sm" className="h-7 px-2" disabled={!doc.url} asChild>
                                                             <a href={doc.url ?? '#'} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${doc.name}`}> <Eye className="h-3.5 w-3.5" /> </a>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    {/* ===== FIM CORREÇÃO ===== */}
                                                    <TooltipContent><p>Abrir/Visualizar</p></TooltipContent>
                                                  </Tooltip>
                                                  {/* Botão Excluir (Funcionalidade Futura) */}
                                             </TableCell>
                                         </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                         </div>
                      )}
                </CardContent>
           </Card>
       )}

    </motion.div>
    </TooltipProvider>
  );
}