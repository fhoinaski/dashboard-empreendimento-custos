"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Import React
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2, Download, Eye, Trash2, FolderOpen, Lock, AlertCircle } from "lucide-react"; // Icons
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils"; // Import cn
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip
import Link from "next/link";

// Types
interface EmpreendimentoOption { _id: string; name: string; folderId?: string; }
interface ClientDocument { _id: string; name: string; type: string; category?: string; fileId: string; url?: string; createdAt: string; }

// Skeleton
const DocumentsSkeleton = () => (
     <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8"> {/* Add padding */}
         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
             <div className="space-y-1.5"><Skeleton className="h-6 w-32 rounded-md" /><Skeleton className="h-4 w-56 rounded-md" /></div>
         </div>
         <Card>
             <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader>
             <CardContent className="p-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                 <Skeleton className="h-40 w-full rounded-lg" />
                 <div className="flex justify-end"><Skeleton className="h-10 w-32 rounded-md" /></div>
             </CardContent>
         </Card>
          <Card>
              <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
              <CardContent><Skeleton className="h-40 w-full rounded-lg" /></CardContent>
          </Card>
     </div>
);

export default function DocumentosPage() {
  // --- HOOKS MOVED TO TOP ---
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [empreendimentos, setEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("");
  const [category, setCategory] = useState<string>("Outros");
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingFilters, setIsFetchingFilters] = useState(true);
  const [isFetchingDocs, setIsFetchingDocs] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<ClientDocument[]>([]);

  const isAdminOrManager = useMemo(() => session?.user?.role === 'admin' || session?.user?.role === 'manager', [session]);

  // Fetch Documents Callback (Moved before early returns)
  const fetchDocuments = useCallback(async (empreendimentoId: string) => {
      if (!isAdminOrManager || !empreendimentoId) { setUploadedDocuments([]); setIsFetchingDocs(false); return; }
      setIsFetchingDocs(true);
      try {
          const response = await fetch(`/api/empreendimentos/${empreendimentoId}/documents`);
          if (!response.ok) throw new Error("Falha ao buscar documentos");
          const data = await response.json();
          setUploadedDocuments(data.documentos || []);
      } catch (error) {
          console.error("Erro buscar docs:", error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar." });
          setUploadedDocuments([]);
      } finally {
          setIsFetchingDocs(false);
      }
  }, [isAdminOrManager, toast]); // Dependencies for fetchDocuments

  // Upload Handler Callback (Moved before early returns)
  const handleUpload = useCallback(async () => {
    if (!isAdminOrManager) { toast({ variant: "destructive", title: "Erro", description: "Ação não permitida." }); return; }
    const selectedEmp = empreendimentos.find(emp => emp._id === selectedEmpreendimento);
    if (!selectedEmp?._id || files.length === 0) {
       toast({ variant: "default", title: "Atenção", description: "Selecione um empreendimento e pelo menos um arquivo." });
       return;
    }
    if (!selectedEmp.folderId) {
        toast({ variant: "destructive", title: "Erro de Configuração", description: "Pasta do Google Drive não encontrada para este empreendimento. Crie a estrutura de pastas na página do empreendimento." });
        return;
    }

    setIsUploading(true);
    try {
        const formData = new FormData();
        files.forEach((file) => formData.append("file", file));
        formData.append("folderId", selectedEmp.folderId);
        formData.append("empreendimentoId", selectedEmp._id);
        formData.append("category", category || "Outros");
        formData.append("saveReference", "true");

        const response = await fetch("/api/drive/upload", { method: "POST", body: formData });
        const data = await response.json(); // Tenta ler JSON mesmo em erro
        if (!response.ok) throw new Error(data.error || `Falha no upload (${response.status})`);

        toast({ title: "Sucesso", description: `${data.files?.length ?? 0} arquivo(s) enviado(s).` });
        setFiles([]);
        fetchDocuments(selectedEmpreendimento); // Re-fetch after upload
    } catch (error) {
        console.error("Erro upload:", error);
        toast({ variant: "destructive", title: "Erro Upload", description: error instanceof Error ? error.message : "Falha." });
    } finally { setIsUploading(false); }
  }, [isAdminOrManager, files, selectedEmpreendimento, empreendimentos, category, toast, fetchDocuments]);

  // Download Handler Callback (Moved before early returns)
  const handleDownloadDocument = useCallback(async (doc: ClientDocument) => {
        if (!doc.url) {
            toast({ variant: "destructive", title: "Erro", description: "Link para download indisponível." });
            return;
        }
        try {
            // Forçar download em vez de abrir no navegador (se possível, depende da config do Drive/Navegador)
            const link = document.createElement('a');
            link.href = doc.url.replace("?export=view&", "?export=download&"); // Tenta forçar download
            link.target = '_blank'; // Abrir em nova aba como fallback
            link.download = doc.name; // Sugere nome do arquivo
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: "Download Iniciado", description: `Baixando ${doc.name}...` });
        } catch (error) {
             console.error("Erro ao tentar baixar:", error);
             toast({ variant: "destructive", title: "Erro Download", description: "Não foi possível iniciar o download." });
             // Fallback: abrir link em nova aba
             window.open(doc.url, '_blank');
        }
    }, [toast]); // Adicionado toast como dependência
  // --- END HOOKS MOVE ---

  // Fetch Empreendimentos Effect (Stays here, depends on isAdminOrManager which depends on session)
  useEffect(() => {
       let isMounted = true;
       async function fetchEmpreendimentos() {
           if (!isAdminOrManager) { setIsFetchingFilters(false); return; }
           setIsFetchingFilters(true);
           try {
               const response = await fetch("/api/empreendimentos?limit=999");
               if (!response.ok) throw new Error("Falha ao carregar");
               const data = await response.json();
               if (isMounted && data?.empreendimentos) {
                   setEmpreendimentos(data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name, folderId: emp.folderId })));
               }
           } catch (error) { if (isMounted) { console.error("Erro filtro:", error); toast({ variant: "destructive", title: "Erro Filtro", description: "Não carregou." }); } }
           finally { if (isMounted) setIsFetchingFilters(false); }
       }
       if (sessionStatus === 'authenticated') fetchEmpreendimentos();
       else if (sessionStatus === 'unauthenticated') setIsFetchingFilters(false);
       return () => { isMounted = false };
   }, [isAdminOrManager, sessionStatus, toast]);

   // Fetch Documents Effect (Stays here, depends on selectedEmpreendimento)
   useEffect(() => {
       if (selectedEmpreendimento && selectedEmpreendimento !== "todos") {
           fetchDocuments(selectedEmpreendimento);
       } else {
           setUploadedDocuments([]);
       }
   }, [selectedEmpreendimento, fetchDocuments]);

  // File Handling (local logic, can stay here)
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files);
          // Basic validation (example: limit 5 files, 10MB each)
          if (files.length + newFiles.length > 5) {
               toast({ variant: "default", title: "Limite excedido", description: "Máximo de 5 arquivos por vez." });
               return;
          }
          const validFiles = newFiles.filter(file => {
               if (file.size > 10 * 1024 * 1024) {
                   toast({ variant: "default", title: "Arquivo grande", description: `${file.name} excede 10MB.` });
                   return false;
               }
               return true;
           });
          setFiles(prev => [...prev, ...validFiles]);
      }
  };
  const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- RENDER STATES ---
  if (sessionStatus === 'loading') {
      return <DocumentsSkeleton />;
  }
  // RBAC Check (Moved after hooks)
  if (!isAdminOrManager && sessionStatus === 'authenticated') {
      return (
          <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm flex flex-col items-center justify-center text-center min-h-[calc(100vh-150px)]">
              <Lock className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground max-w-sm">A gestão de documentos está disponível apenas para Administradores e Gerentes.</p>
          </div>
      );
  }
   if (sessionStatus === 'unauthenticated') {
       return <div className="p-6 text-center text-red-500">Faça login para gerenciar documentos.</div>;
   }
   // Combined loading state
   if (isFetchingFilters || (isAdminOrManager && isFetchingDocs && selectedEmpreendimento && selectedEmpreendimento !== "todos")) {
        return <DocumentsSkeleton />;
   }

  // --- RENDER UPLOAD FORM & DOCUMENT LIST ---
  return (
    <TooltipProvider>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
       <div className="border-b pb-4">
           <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Documentos</h2>
           <p className="text-muted-foreground text-sm">Upload e visualize documentos por empreendimento via Google Drive.</p>
       </div>

      {/* Upload Card */}
       <Card>
         <CardHeader>
             <CardTitle>Upload de Novos Documentos</CardTitle>
             <CardDescription>Selecione o empreendimento, categoria e os arquivos para enviar.</CardDescription>
         </CardHeader>
         <CardContent className="p-6 space-y-6">
           {/* Filters for Upload */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label htmlFor="empreendimento-select" className="block text-sm font-medium mb-1">Empreendimento *</label>
               <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento} disabled={isUploading}>
                 <SelectTrigger id="empreendimento-select" className={cn(isFetchingFilters && "text-muted-foreground")}>
                   <SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Selecione..."} />
                 </SelectTrigger>
                 <SelectContent>
                   {empreendimentos.length === 0 && !isFetchingFilters ? (
                     <div className="p-4 text-sm text-muted-foreground text-center">Nenhum empreendimento encontrado.</div>
                   ) : (
                     empreendimentos.map((emp) => (
                       <SelectItem key={emp._id} value={emp._id} disabled={!emp.folderId} title={!emp.folderId ? "Estrutura de pastas não criada no Drive" : ""}>
                         {emp.name} {!emp.folderId && "(Setup Drive Pendente)"}
                       </SelectItem>
                     ))
                   )}
                 </SelectContent>
               </Select>
                {!isFetchingFilters && empreendimentos.length === 0 && (
                   <p className="text-xs text-muted-foreground mt-1">Crie um empreendimento primeiro.</p>
                )}
                {selectedEmpreendimento && !empreendimentos.find(e=>e._id===selectedEmpreendimento)?.folderId && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                         <AlertCircle className="h-3 w-3"/>
                         A estrutura de pastas precisa ser criada na <Link href={`/dashboard/empreendimentos/${selectedEmpreendimento}`} className="underline hover:text-destructive/80">página do empreendimento</Link>.
                    </p>
                )}
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
           {/* File Dropzone / Selection */}
           <div>
                <label htmlFor="file-upload" className="block text-sm font-medium mb-1">Arquivos *</label>
                <Card className={cn("border-dashed border-2 hover:border-primary transition-colors", files.length > 0 && "border-solid border-primary/50")}>
                    <CardContent className="p-4">
                        <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer rounded-md", isUploading ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50")}>
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-primary font-medium">Clique para selecionar ou arraste</span>
                            <span className="text-xs text-muted-foreground mt-1">Máximo 5 arquivos, 10MB cada</span>
                            <Input id="file-upload" type="file" className="hidden" multiple onChange={handleFileChange} disabled={isUploading || !selectedEmpreendimento || !empreendimentos.find(e=>e._id===selectedEmpreendimento)?.folderId} />
                        </label>
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Selecionados:</p>
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-muted/30 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate" title={file.name}>{file.name}</span>
                                            <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFile(index)} disabled={isUploading}>
                                            <X className="h-4 w-4" /><span className="sr-only">Remover</span>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
           </div>
           {/* Upload Button */}
           <div className="flex justify-end">
               <Button onClick={handleUpload} disabled={isUploading || !selectedEmpreendimento || files.length === 0 || !empreendimentos.find(e=>e._id===selectedEmpreendimento)?.folderId}>
                   {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                   {isUploading ? "Enviando..." : `Enviar ${files.length > 0 ? files.length : ''} Arquivo(s)`}
               </Button>
           </div>
         </CardContent>
       </Card>

       {/* Document List Card */}
       {selectedEmpreendimento && selectedEmpreendimento !== "todos" && (
           <Card>
               <CardHeader>
                   <CardTitle>Documentos de: {empreendimentos.find(e => e._id === selectedEmpreendimento)?.name ?? '...'}</CardTitle>
                   <CardDescription>Arquivos armazenados no Google Drive associados a este projeto.</CardDescription>
               </CardHeader>
                <CardContent>
                     {isFetchingDocs ? ( <Skeleton className="h-40 w-full rounded-lg" /> ) : uploadedDocuments.length === 0 ? (
                         <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center">
                              <FolderOpen className="h-10 w-10 mb-3 opacity-50"/>
                              Nenhum documento encontrado para este empreendimento. <br/> Faça upload usando o formulário acima.
                         </div>
                      ) : (
                         <div className="border rounded-md overflow-hidden">
                             <Table>
                                 <TableHeader><TableRow><TableHead className="text-xs">Nome</TableHead><TableHead className="text-xs hidden md:table-cell">Tipo</TableHead><TableHead className="text-xs hidden sm:table-cell">Data Upload</TableHead><TableHead className="text-right text-xs">Ações</TableHead></TableRow></TableHeader>
                                 <TableBody>
                                     {uploadedDocuments.map((doc) => (
                                         <TableRow key={doc._id}>
                                             <TableCell className="font-medium text-sm flex items-center gap-1.5"><FileText className="h-4 w-4 text-muted-foreground flex-shrink-0"/><span className="truncate max-w-[200px] sm:max-w-xs md:max-w-md" title={doc.name}>{doc.name}</span></TableCell>
                                             <TableCell className="text-xs hidden md:table-cell">{doc.type || 'Desconhecido'}</TableCell>
                                             <TableCell className="text-xs hidden sm:table-cell">{format(new Date(doc.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                                             <TableCell className="text-right">
                                                  <Tooltip>
                                                      <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDownloadDocument(doc)} className="h-7 px-2">
                                                                <Download className="h-3.5 w-3.5" />
                                                            </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent><p>Download / Visualizar</p></TooltipContent>
                                                  </Tooltip>
                                                  {/* Adicionar botão de exclusão se necessário */}
                                                  {/* <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5"/></Button> */}
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