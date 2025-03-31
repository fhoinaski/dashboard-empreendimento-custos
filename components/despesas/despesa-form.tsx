// components/despesas/despesa-form.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Removed Loading import as it's not used directly here

const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- Corrected Zod Schema ---
const formSchema = z.object({
  description: z.string().min(3, { message: "Descrição: Mínimo 3 caracteres." }),
  value: z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0.01, { message: "Valor deve ser maior que R$ 0,00." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  dueDate: z.date({ required_error: "Vencimento é obrigatório." }),
  status: z.string().min(1, { message: "Status é obrigatório." }),
  empreendimento: z.string().min(1, { message: "Empreendimento é obrigatório." }),
  category: z.string().min(1, { message: "Categoria é obrigatória." }),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  // Use z.any() and refine during validation (client-side)
  file: z.any()
    .refine((file) => !file || (typeof window !== 'undefined' && file instanceof File), { // Check instanceof only on client
      message: "Arquivo inválido. Selecione um arquivo válido.",
    })
    .refine((file) => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB.`)
    .refine((file) => !file || ACCEPTED_FILE_TYPES.includes(file.type), `Tipo inválido. Aceitos: JPG, PNG, GIF, PDF.`)
    .optional()
    .nullable(),
});
// --- End Corrected Zod Schema ---


interface EmpreendimentoOption { _id: string; name: string; }

export default function DespesaForm() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [empreendimentos, setEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [isLoading, setIsLoading] = useState(false); // For form submission loading
  const [isFetchingEmpreendimentos, setIsFetchingEmpreendimentos] = useState(true); // For dropdown loading

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange', // Validate on change for better UX
    defaultValues: {
      description: "",
      value: undefined, // Start as undefined
      date: new Date(),
      dueDate: undefined, // Start as undefined for clearer selection
      status: "",
      empreendimento: "",
      category: "",
      paymentMethod: "",
      notes: "",
      file: null,
    },
  });

  // Fetch Empreendimentos for Dropdown
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      setIsFetchingEmpreendimentos(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999"); // Fetch all for dropdown
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
        const data = await response.json();
        if (isMounted && data && Array.isArray(data.empreendimentos)) {
          const fetchedList = data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name }));
          setEmpreendimentos(fetchedList);
          // Pre-select empreendimento from URL after fetching is complete
          const empreendimentoIdFromUrl = searchParams.get('empreendimento');
            // Type-safe check for empreendimento ID
            if (empreendimentoIdFromUrl && fetchedList.some((emp: EmpreendimentoOption) => emp._id === empreendimentoIdFromUrl)) {
            form.setValue('empreendimento', empreendimentoIdFromUrl as string, { shouldValidate: true });
            }
        } else if (isMounted) {
          throw new Error("Formato de dados inválido recebido para empreendimentos");
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao carregar empreendimentos:", error);
          toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar lista de empreendimentos." });
          setEmpreendimentos([]); // Set empty on error
        }
      } finally {
        if (isMounted) setIsFetchingEmpreendimentos(false);
      }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, [toast, searchParams, form]); // form is dependency for setValue

  // Form Submission Handler
  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true); // Set loading state for submission
    try {
      const formData = new FormData();
      // Append all fields carefully
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'file' && value instanceof File) { // Handle File specifically
          formData.append(key, value, value.name);
        } else if (value instanceof Date) {
          formData.append(key, value.toISOString());
        } else if (value !== null && value !== undefined && value !== '') {
          formData.append(key, String(value)); // Convert others to string
        }
      });

       console.log("Enviando dados do formulário...");
       // Log FormData entries for debugging
       // for (let pair of formData.entries()) { console.log(pair[0]+ ', ' + pair[1]); }

      const response = await fetch("/api/despesas", {
        method: "POST",
        body: formData,
        // No 'Content-Type' header needed for FormData, browser sets it
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Erro da API:", responseData);
        throw new Error(responseData.error || responseData.details || `Falha ao cadastrar (${response.status})`);
      }

      toast({
        title: "Sucesso!",
        description: "A despesa foi criada com sucesso.",
        variant: 'default', // Use default variant for success
      });

      form.reset(); // Reset form fields
      setSelectedFileName(null); // Clear file state
      setSelectedFileSize(null);
      // Optionally delay redirect slightly to show toast
      // await new Promise(resolve => setTimeout(resolve, 500));
      router.push("/dashboard/despesas"); // Redirect after success
      router.refresh(); // Attempt to refresh data on the target page

    } catch (error) {
      console.error("Erro ao cadastrar despesa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao Salvar",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      });
    } finally {
      setIsLoading(false); // Reset loading state
    }
  }, [form, router, toast]); // Dependencies for the callback

  // File Handling Functions (Remain the same)
   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => {
    const file = e.target.files?.[0] ?? null;

     // Use the updated schema for validation
     const fileValidationSchema = z.any()
        .refine((f) => !f || (typeof window !== 'undefined' && f instanceof File), { message: "Arquivo inválido." })
        .refine((f) => !f || f.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
        .refine((f) => !f || ACCEPTED_FILE_TYPES.includes(f.type), `Tipo inválido.`);

    const validationResult = fileValidationSchema.safeParse(file);

    if (validationResult.success) {
      fieldOnChange(file);
      setSelectedFileName(file ? file.name : null);
      setSelectedFileSize(file ? file.size : null);
      form.clearErrors("file"); // Clear previous errors if valid
    } else {
      fieldOnChange(null); // Important: Set field value to null on error
      setSelectedFileName(null);
      setSelectedFileSize(null);
      // Set the error message from Zod's result
      form.setError("file", { message: validationResult.error.errors[0]?.message || "Erro no arquivo." });
      e.target.value = ''; // Clear the file input visually
    }
  };

  const removeFile = (fieldOnChange: (...event: any[]) => void) => {
    fieldOnChange(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    form.clearErrors("file");
    // Also clear the visual input element
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // --- RENDER ---
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
                <Link href="/dashboard/despesas" aria-label="Voltar para Despesas"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Voltar</p></TooltipContent>
          </Tooltip>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Nova Despesa</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Registre os detalhes da despesa e anexe o comprovante.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Empreendimento Dropdown */}
                <FormField
                  control={form.control}
                  name="empreendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value} // Controlled component
                        disabled={isFetchingEmpreendimentos || isLoading}
                        required
                      >
                        <FormControl>
                          <SelectTrigger className={cn(isFetchingEmpreendimentos && "text-muted-foreground")}>
                            <SelectValue placeholder={isFetchingEmpreendimentos ? "Carregando..." : "Selecione o empreendimento"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isFetchingEmpreendimentos ? (
                            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...</div>
                          ) : empreendimentos.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum empreendimento cadastrado.</div>
                          ) : (
                            empreendimentos.map((emp) => (
                              <SelectItem key={emp._id} value={emp._id}>
                                {emp.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="Ex: Compra de cimento (NF 123)" {...field} disabled={isLoading} aria-required="true" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Value */}
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="150.50"
                          {...field}
                           // Ensure value sent is a number or empty string for controlled input
                           value={field.value === undefined ? '' : field.value}
                           onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          disabled={isLoading}
                          aria-required="true"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {/* Date */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal h-10", !field.value && "text-muted-foreground")} // Consistent height
                                disabled={isLoading}
                                aria-required="true"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={isLoading}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Due Date */}
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Vencimento <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal h-10", !field.value && "text-muted-foreground")} // Consistent height
                                disabled={isLoading}
                                aria-required="true"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={isLoading}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value} // Controlled
                        disabled={isLoading}
                        required
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status inicial" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pago">Pago</SelectItem>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="A vencer">A vencer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value} // Controlled
                        disabled={isLoading}
                        required
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger></FormControl>
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
                  )}
                />
                 {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento</FormLabel>
                      <FormControl><Input placeholder="Ex: Boleto Banco X, Cartão Final 1234" {...field} disabled={isLoading} /></FormControl>
                      <FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" /> Opcional. Ajuda na conciliação.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Textarea placeholder="Detalhes adicionais, número da nota fiscal, centro de custo..." className="min-h-[100px] resize-y" {...field} disabled={isLoading} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* File Upload */}
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field }) => ( // Pass field object which includes onChange, etc.
                    <FormItem>
                      <FormLabel htmlFor="file-upload">Comprovante (Opcional)</FormLabel>
                      <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName}>
                        <CardContent className="p-4">
                          {/* Display selected file info */}
                          <AnimatePresence>
                            {selectedFileName && (
                              <motion.div
                                key={selectedFileName} // Use filename as key for animation
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mb-4" // Add margin when file is shown
                              >
                                <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
                                  <div className="flex items-center gap-2 min-w-0"> {/* Prevent text overflow */}
                                    <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate" title={selectedFileName}>
                                        {selectedFileName}
                                      </span>
                                      {selectedFileSize !== null && (
                                        <span className="text-xs text-muted-foreground">
                                          {(selectedFileSize / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Remove button */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                       <Button
                                         type="button" // Important: prevent form submission
                                         variant="ghost"
                                         size="icon"
                                         className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                                         onClick={() => removeFile(field.onChange)} // Use field.onChange to update form state
                                         disabled={isLoading}
                                         aria-label="Remover arquivo"
                                       >
                                         <X className="h-4 w-4" />
                                       </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Remover</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* File input trigger area (conditionally shown) */}
                          {!selectedFileName && (
                            <label
                              htmlFor="file-upload"
                              className={cn(
                                "flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md",
                                isLoading ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50" // Disable visually when loading
                              )}
                            >
                              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-sm text-primary font-medium">Clique para selecionar</span>
                              <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                              <span className="text-xs text-muted-foreground mt-2">Imagem ou PDF (máx. {MAX_FILE_SIZE_MB}MB)</span>
                              <FormControl>
                                {/* Hidden actual file input */}
                                <Input
                                  id="file-upload"
                                  type="file"
                                  className="hidden"
                                  accept={ACCEPTED_FILE_TYPES.join(',')}
                                  disabled={isLoading}
                                  // Use field props for react-hook-form integration
                                  ref={field.ref} // Register ref
                                  name={field.name} // Register name
                                  onBlur={field.onBlur} // Register blur handler
                                  onChange={(e) => handleFileSelect(e, field.onChange)} // Use custom handler
                                />
                              </FormControl>
                            </label>
                          )}
                          {/* Display validation errors */}
                          <FormMessage className="mt-2" />
                        </CardContent>
                      </Card>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
              <Button
                variant="outline"
                type="button" // Ensure it doesn't submit the form
                onClick={() => router.push('/dashboard/despesas')}
                disabled={isLoading}
                className="w-full sm:w-auto order-last sm:order-first"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isFetchingEmpreendimentos || !form.formState.isValid} // Disable if loading, fetching filters, or form is invalid
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </span>
                ) : (
                  "Salvar Despesa"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </TooltipProvider>
  );
}