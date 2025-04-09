"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban, Eye, Trash2, Building, ClipboardList, Shapes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeParseDate } from '@/utils/format';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDespesas } from "@/hooks/useDespesas";
import type { UpdateDespesaFormInput, Attachment, DespesaStatus, DespesaCategory } from "@/lib/trpc/types";

// File validation constants
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Zod schemas for enums
const despesaStatusEnumSchema = z.enum(['Pago', 'Pendente', 'A vencer', 'Rejeitado']);
const despesaCategoryEnumSchema = z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros']);

// Form schema
const formSchema = z.object({
  description: z.string().min(3, { message: "Descrição: Mínimo 3 caracteres." }),
  value: z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0.01, { message: "Valor deve ser maior que R$ 0,00." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  dueDate: z.date({ required_error: "Vencimento é obrigatório." }),
  status: despesaStatusEnumSchema,
  category: despesaCategoryEnumSchema,
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  file: z.any()
    .optional().nullable()
    .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), { message: "Selecione um arquivo válido." })
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
    .refine(file => !file || ACCEPTED_FILE_TYPES.includes(file?.type || ''), `Tipo inválido: ${ACCEPTED_FILE_TYPES.join(', ')}`),
  empreendimentoName: z.string().optional(),
}).refine(data => {
  return data.dueDate && data.date && isValid(data.dueDate) && isValid(data.date) && data.dueDate >= data.date;
}, { message: "Vencimento não pode ser anterior à Data.", path: ["dueDate"] });

type DespesaFormData = z.infer<typeof formSchema>;

export default function DespesaEditForm({ id }: { id: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isUploadingViaApiRoute, setIsUploadingViaApiRoute] = useState(false);
  const [removedAttachmentInfo, setRemovedAttachmentInfo] = useState<{ id?: string; fileId?: string } | null>(null);

  const router = useRouter();
  const { toast } = useToast();
  const { getDespesaById, updateDespesa, isUpdating } = useDespesas();
  const { data: initialDespesaData, isLoading: isLoadingData, error: loadingError, isFetching } = getDespesaById(id);

  const isSubmitting = isUpdating || isUploadingViaApiRoute;

  const form = useForm<DespesaFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      value: 0,
      date: new Date(), // Default to today to avoid undefined
      dueDate: new Date(),
      status: "Pendente" as DespesaStatus,
      category: "Outros" as DespesaCategory,
      paymentMethod: null,
      notes: null,
      file: null,
      empreendimentoName: "",
    },
  });

  // Populate form with fetched data
  useEffect(() => {
    if (isLoadingData || isFetching || loadingError || !initialDespesaData) return;

    console.log("[DespesaEditForm] Initial Data:", initialDespesaData);

    try {
      const parsedDate = safeParseDate(initialDespesaData.date) ?? new Date();
      const parsedDueDate = safeParseDate(initialDespesaData.dueDate) ?? new Date();

      const validStatus = despesaStatusEnumSchema.safeParse(initialDespesaData.status).success
        ? initialDespesaData.status
        : "Pendente";
      const validCategory = despesaCategoryEnumSchema.safeParse(initialDespesaData.category).success
        ? initialDespesaData.category
        : "Outros";

      // Reset form with all values
      form.reset({
        description: initialDespesaData.description || "",
        value: initialDespesaData.value ?? 0,
        date: parsedDate,
        dueDate: parsedDueDate,
        status: validStatus,
        category: validCategory,
        paymentMethod: initialDespesaData.paymentMethod ?? null,
        notes: initialDespesaData.notes ?? null,
        file: null,
        empreendimentoName: initialDespesaData.empreendimento?.name || "Não encontrado",
      }, { keepDefaultValues: false });

      // Explicitly set select values to ensure they update
      form.setValue("status", validStatus, { shouldValidate: true });
      form.setValue("category", validCategory, { shouldValidate: true });

      setExistingAttachments(
        (initialDespesaData.attachments ?? []).filter((att): att is Attachment =>
          typeof att.fileId === 'string' && typeof att.name === 'string'
        )
      );
      setRemovedAttachmentInfo(null);
    } catch (error) {
      console.error("[DespesaEditForm] Error processing data:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Carregar Dados",
        description: "Não foi possível preencher o formulário.",
      });
    }
  }, [initialDespesaData, isLoadingData, isFetching, loadingError, form, toast]);

  const onSubmit = useCallback(async (values: DespesaFormData) => {
    if (!initialDespesaData || !initialDespesaData.empreendimento?._id) {
      toast({ variant: "destructive", title: "Erro", description: "Dados originais ou ID do empreendimento ausentes." });
      return;
    }
    const empreendimentoIdParaUpload = initialDespesaData.empreendimento._id;

    let apiRouteUploadResult: { success: boolean; fileId?: string; fileName?: string; url?: string; error?: string } | null = null;
    setIsUploadingViaApiRoute(false);

    try {
      const newFile = values.file as File | null;

      if (newFile instanceof File) {
        setIsUploadingViaApiRoute(true);
        const formData = new FormData();
        formData.append('file', newFile);
        formData.append('empreendimentoId', empreendimentoIdParaUpload);
        formData.append('despesaId', id);
        formData.append('category', 'Despesas');

        const uploadResponse = await fetch('/api/upload-drive-despesa', { method: 'POST', body: formData });
        apiRouteUploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !apiRouteUploadResult?.success) {
          throw new Error(apiRouteUploadResult?.error || 'Falha ao enviar novo anexo');
        }
        setRemovedAttachmentInfo(null);
        setIsUploadingViaApiRoute(false);
      }

      const dataToUpdate: Partial<UpdateDespesaFormInput> = {};
      let hasChanges = false;

      (Object.keys(values) as Array<keyof DespesaFormData>).forEach(key => {
        if (key === 'file' || key === 'empreendimentoName') return;

        const formValue = values[key];
        const originalValue = (initialDespesaData as any)[key];
        let valueChanged = false;

        if (formValue instanceof Date && originalValue) {
          const originalDate = safeParseDate(originalValue);
          valueChanged = !originalDate || formValue.toISOString() !== originalDate.toISOString();
        } else if (typeof formValue === 'number' && typeof originalValue === 'number') {
          valueChanged = formValue !== originalValue;
        } else {
          const formString = formValue === null ? null : String(formValue ?? '').trim();
          const originalString = originalValue === null ? null : String(originalValue ?? '').trim();
          valueChanged = formString !== originalString;
        }

        if (valueChanged) {
          (dataToUpdate as any)[key] = (key === 'date' || key === 'dueDate')
            ? (formValue as Date).toISOString()
            : formValue;
          hasChanges = true;
        }
      });

      if (apiRouteUploadResult?.success && apiRouteUploadResult.fileId) {
        dataToUpdate.attachments = [{
          fileId: apiRouteUploadResult.fileId,
          name: apiRouteUploadResult.fileName,
          url: apiRouteUploadResult.url,
        }];
        hasChanges = true;
      } else if (removedAttachmentInfo) {
        dataToUpdate.attachments = null;
        hasChanges = true;
      }

      if (!hasChanges) {
        toast({ title: "Nenhuma alteração", description: "Nenhuma mudança detectada." });
        return;
      }

      await updateDespesa(id, dataToUpdate as UpdateDespesaFormInput);
      toast({ title: "Sucesso", description: "Despesa atualizada com sucesso!" });
      setSelectedFile(null);
      setSelectedFileName(null);
      setSelectedFileSize(null);
      setRemovedAttachmentInfo(null);
      router.push(`/dashboard/despesas/${id}`);
      router.refresh();
    } catch (error) {
      console.error("[DespesaEditForm] Submit Error:", error);
      setIsUploadingViaApiRoute(false);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: error instanceof Error ? error.message : "Erro ao salvar alterações.",
      });
    }
  }, [id, router, toast, form, updateDespesa, initialDespesaData, removedAttachmentInfo]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => {
    const file = e.target.files?.[0] ?? null;
    form.setValue('file', file, { shouldValidate: true, shouldDirty: true });
    setRemovedAttachmentInfo(null);

    setTimeout(() => {
      const fieldState = form.getFieldState('file');
      if (file && !fieldState.error) {
        setSelectedFile(file);
        setSelectedFileName(file.name);
        setSelectedFileSize(file.size);
      } else {
        setSelectedFile(null);
        setSelectedFileName(null);
        setSelectedFileSize(null);
        if (fieldState.error) {
          toast({ variant: "destructive", title: "Erro", description: fieldState.error.message });
        }
      }
    }, 50);
  };

  const handleRemoveAttachment = (fieldOnChange: (...event: any[]) => void, attachmentInfo?: { id?: string; fileId?: string }) => {
    fieldOnChange(null);
    setSelectedFile(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    form.clearErrors("file");

    if (attachmentInfo) {
      setRemovedAttachmentInfo(attachmentInfo);
      setExistingAttachments(prev => prev.filter(att => (att._id || att.fileId) !== (attachmentInfo.id || attachmentInfo.fileId)));
      form.setValue('file', undefined, { shouldDirty: true });
    } else {
      setRemovedAttachmentInfo(null);
    }
  };

  // Show loading state only during initial load or refetch
  if (isLoadingData || isFetching) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
          <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
          <div className="space-y-1.5 flex-grow">
            <Skeleton className="h-6 w-3/4 sm:w-1/2" />
            <Skeleton className="h-4 w-1/2 sm:w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    );
  }

  if (loadingError) {
    return <div className="p-6 text-center text-destructive">Erro ao carregar dados: {loadingError.message}</div>;
  }

  if (!initialDespesaData) {
    return <div className="p-6 text-center text-muted-foreground">Despesa não encontrada.</div>;
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"
      >
        <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild disabled={isSubmitting}>
                <Link href={`/dashboard/despesas/${id}`} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Voltar para Detalhes</p></TooltipContent>
          </Tooltip>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Editar Despesa</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Atualize as informações.</p>
          </div>
        </div>

        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <div className="space-y-6">
                  <FormField control={form.control} name="empreendimentoName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento</FormLabel>
                      <FormControl><Input {...field} readOnly disabled className="bg-muted/50 cursor-not-allowed border-2" /></FormControl>
                      <FormDescription className="text-xs">Este campo não pode ser alterado.</FormDescription>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="Ex: Compra de cimento (NF 123)" {...field} disabled={isSubmitting} aria-required="true" className="border-2" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0.01" placeholder="150.50" {...field} onChange={e => field.onChange(+e.target.value)} disabled={isSubmitting} aria-required="true" className="border-2" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 border-2", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Vencimento <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 border-2", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required aria-required="true">
                        <FormControl>
                          <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary h-10">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Selecione" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pago">Pago</SelectItem>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="A vencer">A vencer</SelectItem>
                          <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-6">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required aria-required="true">
                        <FormControl>
                          <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary h-10">
                            <div className="flex items-center gap-2">
                              <Shapes className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Selecione" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Material">Material</SelectItem>
                          <SelectItem value="Serviço">Serviço</SelectItem>
                          <SelectItem value="Equipamento">Equipamento</SelectItem>
                          <SelectItem value="Taxas">Taxas</SelectItem>
                          <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento</FormLabel>
                      <FormControl><Input placeholder="Ex: Boleto Banco X" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value || null)} disabled={isSubmitting} className="border-2 h-10" /></FormControl>
                      <FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" /> Opcional.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Textarea placeholder="Detalhes adicionais..." className="min-h-[100px] resize-y border-2" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value || null)} disabled={isSubmitting} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="file" render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="file-upload">Anexo</FormLabel>
                      <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName || existingAttachments.length > 0 || removedAttachmentInfo}>
                        <CardContent className="p-4">
                          {!removedAttachmentInfo && existingAttachments.length > 0 && (
                            <div className="mb-4 space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Anexo atual:</p>
                              {existingAttachments.map((att) => (
                                <div key={att.fileId || att._id} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    <span className="text-sm truncate" title={att.name}>{att.name || 'Nome indisponível'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {att.url && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" asChild>
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" aria-label="Visualizar anexo atual"><Eye className="h-4 w-4" /></a>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Visualizar</p></TooltipContent>
                                      </Tooltip>
                                    )}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveAttachment(field.onChange, { id: att._id?.toString(), fileId: att.fileId })} disabled={isSubmitting} aria-label="Remover anexo atual">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Remover ao Salvar</p></TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <AnimatePresence>
                            {selectedFileName && (
                              <motion.div key={selectedFileName} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4">
                                <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-primary/5">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate" title={selectedFileName}>{selectedFileName}</span>
                                      {selectedFileSize !== null && (<span className="text-xs text-muted-foreground">{(selectedFileSize / 1024 / 1024).toFixed(2)} MB</span>)}
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => handleRemoveAttachment(field.onChange)} disabled={isSubmitting} aria-label="Remover seleção">
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Remover seleção</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {(!existingAttachments.length || removedAttachmentInfo) && !selectedFileName && (
                            <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md", isSubmitting ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50", 'border-dashed border-2')}>
                              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-sm text-primary font-medium">{removedAttachmentInfo ? 'Substituir Anexo Removido' : 'Selecionar Anexo'}</span>
                              <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                              <span className="text-xs text-muted-foreground mt-2">{ACCEPTED_FILE_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')} (máx. {MAX_FILE_SIZE_MB}MB)</span>
                              <FormControl>
                                <Input id="file-upload" type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(',')} disabled={isSubmitting} ref={field.ref} name={field.name} onBlur={field.onBlur} onChange={(e) => handleFileSelect(e, field.onChange)} />
                              </FormControl>
                            </label>
                          )}
                          <FormMessage className="mt-2" />
                        </CardContent>
                      </Card>
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
                <Button variant="outline" type="button" onClick={() => router.push(`/dashboard/despesas/${id}`)} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first">
                  <Ban className="mr-2 h-4 w-4" /> Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoadingData || isFetching || (!form.formState.isDirty && !form.getValues('file') && !removedAttachmentInfo)} className="w-full sm:w-auto">
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isUploadingViaApiRoute ? 'Enviando Anexo...' : 'Salvando...'}
                    </span>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" /> Salvar Alterações</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </FormProvider>
      </motion.div>
    </TooltipProvider>
  );
}