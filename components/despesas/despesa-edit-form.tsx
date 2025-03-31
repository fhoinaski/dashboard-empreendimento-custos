"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban } from "lucide-react"; // Added Save, Ban
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Loading } from "@/components/ui/loading"; // Use your Loading component
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// Validation Schema (similar to create form, file optional on edit)
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const formSchema = z.object({
  description: z.string().min(3, { message: "Descrição: Mínimo 3 caracteres." }),
  value: z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0.01, { message: "Valor deve ser maior que R$ 0,00." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  dueDate: z.date({ required_error: "Vencimento é obrigatório." }),
  status: z.string().min(1, { message: "Status é obrigatório." }),
  category: z.string().min(1, { message: "Categoria é obrigatória." }),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  file: z.instanceof(File).optional().nullable() // File is optional during edit
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB.`)
    .refine(file => !file || ACCEPTED_FILE_TYPES.includes(file.type), `Tipo inválido. Aceitos: JPG, PNG, GIF, PDF.`),
  empreendimentoName: z.string().optional(), // Read-only field
});

// Define a more specific type for the fetched despesa data
interface FetchedDespesa {
    _id: string;
    description: string;
    value: number;
    date: string; // ISO string from API
    dueDate: string; // ISO string from API
    status: string;
    category: string;
    paymentMethod?: string;
    notes?: string;
    empreendimento: {
        _id: string;
        name: string;
    };
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: string }>;
    // Add other fields if needed (createdAt, createdBy, etc.)
}


export default function DespesaEditForm({ id }: { id: string }) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<NonNullable<FetchedDespesa['attachments']>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for initial data fetch
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for form submission
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      value: undefined, // Start as undefined
      date: undefined, // Start as undefined
      dueDate: undefined, // Start as undefined
      status: "",
      category: "",
      paymentMethod: "",
      notes: "",
      file: null,
      empreendimentoName: "", // Initialize read-only field
    },
  });

  // Fetch existing data
  useEffect(() => {
    let isMounted = true;
    async function fetchDespesa() {
      setIsLoadingData(true);
      try {
        console.log(`Buscando despesa com ID: ${id}`);
        const response = await fetch(`/api/despesas/${id}`);
        if (!response.ok) throw new Error("Falha ao carregar dados da despesa para edição.");

        const data: { despesa: FetchedDespesa } = await response.json();
        console.log("Dados da despesa recebidos:", data.despesa);

        if (isMounted) {
          const despesa = data.despesa;
           // Validate dates before parsing
           const parsedDate = despesa.date ? parseISO(despesa.date) : undefined;
           const parsedDueDate = despesa.dueDate ? parseISO(despesa.dueDate) : undefined;
           if (!parsedDate || !parsedDueDate || isNaN(parsedDate.getTime()) || isNaN(parsedDueDate.getTime())) {
               throw new Error("Datas inválidas recebidas da API.");
           }

          form.reset({
            description: despesa.description || "",
            value: despesa.value ?? undefined,
            category: despesa.category || "",
            status: despesa.status || "",
            date: parsedDate,
            dueDate: parsedDueDate,
            paymentMethod: despesa.paymentMethod || "",
            notes: despesa.notes || "",
            empreendimentoName: despesa.empreendimento?.name || "Não encontrado", // Set read-only field
          });
          setExistingAttachments(despesa.attachments || []);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar dados para edição:", error);
          toast({
            variant: "destructive",
            title: "Erro ao Carregar",
            description: error instanceof Error ? error.message : "Não foi possível carregar os dados da despesa.",
          });
          // Optionally redirect back if data loading fails critically
          // router.push(`/dashboard/despesas`);
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    fetchDespesa();
    return () => { isMounted = false };
  }, [id, toast, form, router]);

  // Handle form submission
  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      // Append only fields that should be updated
      formData.append("description", values.description);
      formData.append("value", values.value.toString());
      formData.append("date", values.date.toISOString());
      formData.append("dueDate", values.dueDate.toISOString());
      formData.append("status", values.status);
      formData.append("category", values.category);
      if (values.paymentMethod) formData.append("paymentMethod", values.paymentMethod);
      if (values.notes) formData.append("notes", values.notes);

      // Append new file only if selected
      if (values.file) {
        formData.append("file", values.file, values.file.name);
      }

      console.log(`Enviando atualização para /api/despesas/${id}`);

      const response = await fetch(`/api/despesas/${id}`, {
        method: "PUT",
        body: formData,
      });

      const responseData = await response.json();
      console.log("Resposta do servidor:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || "Falha ao atualizar despesa");
      }

      toast({
        title: "Sucesso!",
        description: "Despesa atualizada.",
      });
      router.push(`/dashboard/despesas/${id}`); // Go back to details page
      router.refresh(); // Refresh data on the previous page

    } catch (error) {
      console.error("Erro ao atualizar despesa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [id, router, toast]);

   // Handle file selection and validation
   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => {
    const file = e.target.files?.[0] ?? null;
    const validationResult = formSchema.shape.file.safeParse(file);

    if (validationResult.success) {
      fieldOnChange(file); // Update form state
      setSelectedFileName(file ? file.name : null);
      setSelectedFileSize(file ? file.size : null);
    } else {
      fieldOnChange(null); // Clear form state on error
      setSelectedFileName(null);
      setSelectedFileSize(null);
      form.setError("file", { message: validationResult.error.errors[0]?.message || "Erro no arquivo." });
      e.target.value = ''; // Clear the file input visually
    }
  };

   // Remove selected file
   const removeFile = (fieldOnChange: (...event: any[]) => void) => {
    fieldOnChange(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    form.clearErrors("file");
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = ''; // Clear the file input visually
  };

  // --- Render Loading State ---
  if (isLoadingData) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
          <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
          <div className="space-y-1.5 flex-grow">
            <Skeleton className="h-6 w-3/4 sm:w-1/2" />
            <Skeleton className="h-4 w-1/2 sm:w-1/3" />
          </div>
        </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-6">
                <Skeleton className="h-10 w-full" />
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

  // --- Render Form ---
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
                 <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild>
                    <Link href={`/dashboard/despesas/${id}`} aria-label="Voltar para Detalhes"><ArrowLeft className="h-4 w-4" /></Link>
                 </Button>
             </TooltipTrigger>
             <TooltipContent><p>Voltar</p></TooltipContent>
          </Tooltip>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Editar Despesa</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Atualize as informações e o comprovante, se necessário.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">

              {/* Left Column */}
              <div className="space-y-6">
                 {/* Empreendimento (Read-only) */}
                 <FormField control={form.control} name="empreendimentoName" render={({ field }) => (
                    <FormItem>
                       <FormLabel>Empreendimento</FormLabel>
                       <FormControl><Input {...field} readOnly disabled className="bg-muted/50 cursor-not-allowed" /></FormControl>
                       <FormDescription className="text-xs">Este campo não pode ser alterado.</FormDescription>
                       <FormMessage />
                    </FormItem>
                 )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Ex: Compra de cimento (NF 123)" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$) <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0.01" placeholder="150.50" {...field} disabled={isSubmitting} aria-required="true" /></FormControl>
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
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
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
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true">
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="A vencer">A vencer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
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
                    <FormControl><Input placeholder="Ex: Boleto Banco X, Cartão Final 1234" {...field} disabled={isSubmitting} /></FormControl>
                     <FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" /> Opcional. Ajuda na conciliação.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl><Textarea placeholder="Detalhes adicionais, número da nota fiscal, centro de custo..." className="min-h-[100px] resize-y" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* File Upload Section */}
                 <FormField control={form.control} name="file" render={({ field }) => (
                    <FormItem>
                        <FormLabel htmlFor="file-upload">Novo Comprovante (Opcional)</FormLabel>
                        <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName || existingAttachments.length > 0}>
                        <CardContent className="p-4">
                            {/* Display Existing Attachments */}
                            {existingAttachments.length > 0 && (
                            <div className="mb-4 space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">Anexo(s) atual(is):</p>
                                {existingAttachments.map((att) => (
                                    <div key={att._id || att.fileId} className="flex items-center justify-between p-2 border rounded-md bg-muted/30">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                        <span className="text-sm truncate" title={att.name}>{att.name || 'Nome indisponível'}</span>
                                    </div>
                                     {att.url && (
                                          <Tooltip>
                                             <TooltipTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" asChild>
                                                     <a href={att.url} target="_blank" rel="noopener noreferrer" aria-label="Visualizar anexo atual"><Info className="h-4 w-4" /></a>
                                                 </Button>
                                             </TooltipTrigger>
                                             <TooltipContent><p>Visualizar anexo atual</p></TooltipContent>
                                         </Tooltip>
                                     )}
                                    </div>
                                ))}
                                <p className="text-xs text-muted-foreground mt-2">Selecionar um novo arquivo abaixo substituirá o anexo existente ao salvar.</p>
                            </div>
                            )}

                            {/* Display Newly Selected File */}
                            <AnimatePresence>
                            {selectedFileName && (
                                <motion.div key={selectedFileName} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4">
                                <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-primary/5">
                                    <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate" title={selectedFileName}>{selectedFileName}</span>
                                        {selectedFileSize !== null && (
                                        <span className="text-xs text-muted-foreground">{(selectedFileSize / 1024 / 1024).toFixed(2)} MB</span>
                                        )}
                                    </div>
                                    </div>
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFile(field.onChange)} disabled={isSubmitting} aria-label="Remover arquivo selecionado"><X className="h-4 w-4" /></Button>
                                        </TooltipTrigger>
                                         <TooltipContent><p>Remover seleção</p></TooltipContent>
                                    </Tooltip>
                                </div>
                                </motion.div>
                            )}
                            </AnimatePresence>

                            {/* File Input Trigger */}
                             <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md", isSubmitting ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50", selectedFileName ? 'border-primary/30' : 'border-dashed border-2')}>
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <span className="text-sm text-primary font-medium">
                                    {selectedFileName ? 'Selecionar outro arquivo' : 'Selecionar novo anexo'}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                                <span className="text-xs text-muted-foreground mt-2">Imagem ou PDF (máx. {MAX_FILE_SIZE_MB}MB)</span>
                                <FormControl>
                                    <Input id="file-upload" type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(',')} disabled={isSubmitting} ref={field.ref} name={field.name} onBlur={field.onBlur} onChange={(e) => handleFileSelect(e, field.onChange)} />
                                </FormControl>
                             </label>
                            <FormMessage className="mt-2" />
                        </CardContent>
                        </Card>
                    </FormItem>
                 )} />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
               <Button variant="outline" type="button" onClick={() => router.push(`/dashboard/despesas/${id}`)} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first">
                  <Ban className="mr-2 h-4 w-4"/> Cancelar
               </Button>
              <Button type="submit" disabled={isSubmitting || !form.formState.isDirty} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <span className="flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</span>
                ) : (
                   <><Save className="mr-2 h-4 w-4"/> Salvar Alterações</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </TooltipProvider>
  );
}