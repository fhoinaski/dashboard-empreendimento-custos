// components/despesas/despesa-form.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban } from "lucide-react";
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
import { useSession } from "next-auth/react";
import { DespesaFormSkeleton } from "./despesa-form-skeleton";

// Schema (status é obrigatório)
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const formSchema = z.object({
  description: z.string().min(3, { message: "Descrição: Mínimo 3 caracteres." }),
  value: z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0.01, { message: "Valor deve ser maior que R$ 0,00." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  dueDate: z.date({ required_error: "Vencimento é obrigatório." }),
  empreendimento: z.string().min(1, { message: "Empreendimento é obrigatório." }),
  category: z.string().min(1, { message: "Categoria é obrigatória." }),
  status: z.string().min(1, { message: "Status Financeiro é obrigatório." }), // Mantido obrigatório
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  file: z
    .any()
    .refine((file) => !file || (typeof window !== "undefined" && file instanceof File), { message: "Arquivo inválido." })
    .refine((file) => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
    .refine((file) => !file || ACCEPTED_FILE_TYPES.includes(file.type), `Tipo inválido.`)
    .optional()
    .nullable(),
});

interface EmpreendimentoOption {
  _id: string;
  name: string;
}

interface EmpreendimentoSelectItem {
  _id: string;
  name: string;
}


export default function DespesaForm() {
  const { data: session, status: sessionStatus } = useSession();
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [allEmpreendimentos, setAllEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingEmpreendimentos, setIsFetchingEmpreendimentos] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "",
      value: undefined,
      date: new Date(),
      dueDate: undefined,
      empreendimento: "",
      category: "",
      // ** Definir um padrão inicial para Status, por exemplo 'Pendente' **
      status: 'Pendente',
      paymentMethod: "",
      notes: "",
      file: null,
    },
  });

  // Lógica do Dropdown de Empreendimentos (sem alterações)
  const dropdownEmpreendimentos = useMemo(() => {
    if (sessionStatus !== "authenticated" || !session?.user) return [];
    const userRole = session.user.role;
    const assignedIds = new Set(session.user.assignedEmpreendimentos || []);
    if (userRole === "admin" || userRole === "manager") return allEmpreendimentos;
    if (userRole === "user") return allEmpreendimentos.filter((emp) => assignedIds.has(emp._id));
    return [];
  }, [allEmpreendimentos, session, sessionStatus]);

  // Fetch Empreendimentos (sem alterações)
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      if (sessionStatus !== "authenticated") {
          setIsFetchingEmpreendimentos(false);
          return;
      }
      setIsFetchingEmpreendimentos(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999");
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
        const data = await response.json();
        if (isMounted && data?.empreendimentos) {
          const fetchedList = data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name }));
          setAllEmpreendimentos(fetchedList);
          const empreendimentoIdFromUrl = searchParams.get("empreendimento");
          if (empreendimentoIdFromUrl && fetchedList.some((emp: EmpreendimentoSelectItem) => emp._id === empreendimentoIdFromUrl)) {
              form.setValue("empreendimento", empreendimentoIdFromUrl, { shouldValidate: true });
          } else if (empreendimentoIdFromUrl) {
               console.warn(`Empreendimento ${empreendimentoIdFromUrl} da URL não encontrado ou não permitido.`);
          }
        } else if (isMounted) { throw new Error("Formato de dados inválido"); }
      } catch (error) {
        if (isMounted) { console.error("Erro ao carregar empreendimentos:", error); toast({ variant: "destructive", title: "Erro", description: "Falha ao carregar lista de empreendimentos." }); setAllEmpreendimentos([]); }
      } finally { if (isMounted) setIsFetchingEmpreendimentos(false); }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false; };
  }, [sessionStatus, searchParams, form, toast]);

  // onSubmit (garantir que status é enviado)
  const onSubmit = useCallback(
    async (values: z.infer<typeof formSchema>) => {
      setIsSubmitting(true);
      try {
        const formData = new FormData();
        formData.append("description", values.description);
        formData.append("value", String(values.value));
        formData.append("date", values.date.toISOString());
        formData.append("dueDate", values.dueDate.toISOString());
        formData.append("empreendimento", values.empreendimento);
        formData.append("category", values.category);
        formData.append("status", values.status); // Enviar o status selecionado
        if (values.paymentMethod) formData.append("paymentMethod", values.paymentMethod);
        if (values.notes) formData.append("notes", values.notes);
        if (values.file instanceof File) formData.append("file", values.file, values.file.name);

        const response = await fetch("/api/despesas", { method: "POST", body: formData });
        const responseData = await response.json();

        if (!response.ok) { throw new Error(responseData.error || responseData.details || `Falha (${response.status})`); }

        toast({ title: "Sucesso!", description: responseData.message, variant: "default" });
        form.reset({
            description: "", value: undefined, date: new Date(), dueDate: undefined,
            empreendimento: "", category: "", status: 'Pendente', // Resetar para Pendente como default
            paymentMethod: "", notes: "", file: null
        });
        setSelectedFileName(null);
        setSelectedFileSize(null);
        router.push("/dashboard/despesas");
        router.refresh();
      } catch (error) {
        console.error("Erro ao cadastrar despesa:", error);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: error instanceof Error ? error.message : "Erro inesperado." });
      } finally {
        setIsSubmitting(false);
      }
    }, [form, router, toast]
   );

  // File handling (sem alterações)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => {
     const file = e.target.files?.[0] ?? null;
     const fileSchema = z.instanceof(File).optional().nullable()
         .refine(f => !f || f.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
         .refine(f => !f || ACCEPTED_FILE_TYPES.includes(f.type), `Tipo inválido.`);
     const validationResult = fileSchema.safeParse(file);
     if (validationResult.success) {
         fieldOnChange(file);
         setSelectedFileName(file ? file.name : null);
         setSelectedFileSize(file ? file.size : null);
         form.clearErrors("file");
     } else {
         fieldOnChange(null);
         setSelectedFileName(null);
         setSelectedFileSize(null);
         form.setError("file", { message: validationResult.error.errors[0]?.message || "Erro no arquivo." });
         e.target.value = '';
     }
   };
  const removeFile = (fieldOnChange: (...event: any[]) => void) => {
    fieldOnChange(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    form.clearErrors("file");
    const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  // --- Verifica o estado combinado de carregamento ---
  const showSkeleton = sessionStatus === "loading" || isFetchingEmpreendimentos;

  // --- Renderização ---
  if (sessionStatus === "unauthenticated") {
     return <div className="p-6 text-center text-red-600">Acesso não autorizado. Faça login.</div>;
  }

  return (
    <TooltipProvider>
      {showSkeleton ? (
        <DespesaFormSkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"
        >
          <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild><Link href="/dashboard/despesas" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link></Button></TooltipTrigger>
              <TooltipContent><p>Voltar</p></TooltipContent>
            </Tooltip>
            <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">Nova Despesa</h2><p className="text-muted-foreground text-sm sm:text-base">Registre os detalhes e anexe o comprovante.</p></div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                {/* Coluna Esquerda */}
                <div className="space-y-6">
                  <FormField control={form.control} name="empreendimento" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Empreendimento <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || dropdownEmpreendimentos.length === 0} required>
                              <FormControl>
                                  <SelectTrigger className={cn(isFetchingEmpreendimentos && "text-muted-foreground")}>
                                      <SelectValue placeholder={isFetchingEmpreendimentos ? "Carregando..." : (dropdownEmpreendimentos.length === 0 ? "Nenhum disponível" : "Selecione")} />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {!isFetchingEmpreendimentos && dropdownEmpreendimentos.length === 0 && (
                                      <div className="p-2 text-center text-xs text-muted-foreground">
                                          {session?.user?.role === 'user' ? "Nenhum empreendimento atribuído." : "Nenhum empreendimento cadastrado."}
                                      </div>
                                  )}
                                  {dropdownEmpreendimentos.map((emp) => (
                                      <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )} />
                   <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Descrição <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ex: Compra de cimento (NF 123)" {...field} disabled={isSubmitting} aria-required="true" /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="value" render={({ field }) => (
                      <FormItem><FormLabel>Valor (R$) <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" step="0.01" min="0.01" placeholder="150.50" {...field} value={field.value === undefined ? "" : field.value} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={isSubmitting} aria-required="true" /></FormControl><FormMessage /></FormItem>
                   )} />
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                     <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Data <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                     )} />
                     <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Vencimento <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !field.value && "text-muted-foreground")} disabled={isSubmitting} aria-required="true"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isSubmitting} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                     )} />
                   </div>
                   {/* *** Campo Status Financeiro - Sempre Visível *** */}
                   <FormField control={form.control} name="status" render={({ field }) => (
                     <FormItem>
                       <FormLabel>Status Financeiro <span className="text-destructive">*</span></FormLabel>
                       <Select
                         onValueChange={field.onChange}
                         value={field.value}
                         disabled={isSubmitting} // Habilitado para todos na criação
                         required
                       >
                         <FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl>
                         <SelectContent>
                           {/* Opções disponíveis para todos */}
                           <SelectItem value="Pago">Pago</SelectItem>
                           <SelectItem value="A vencer">A vencer</SelectItem>
                           <SelectItem value="Pendente">Pendente</SelectItem>
                         </SelectContent>
                       </Select>
                       <FormMessage />
                        {/* Opcional: Adicionar descrição se o fluxo de aprovação ainda existir */}
                        {session?.user?.role !== 'admin' && (
                           <FormDescription className="text-xs flex items-center gap-1">
                                <Info className="h-3 w-3" /> Esta despesa ainda precisará ser aprovada por um administrador.
                           </FormDescription>
                       )}
                     </FormItem>
                   )} />
                   {/* *** Fim Campo Status Financeiro *** */}
                </div>

                {/* Coluna Direita */}
                <div className="space-y-6">
                   <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem><FormLabel>Categoria <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting} required><FormControl><SelectTrigger><SelectValue placeholder="Selecione categoria" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Material">Material</SelectItem><SelectItem value="Serviço">Serviço</SelectItem><SelectItem value="Equipamento">Equipamento</SelectItem><SelectItem value="Taxas">Taxas</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem><FormLabel>Método Pagamento</FormLabel><FormControl><Input placeholder="Ex: Boleto, Cartão" {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" />Opcional.</FormDescription><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea placeholder="Detalhes adicionais..." className="min-h-[100px] resize-y" {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                   )} />
                   <FormField control={form.control} name="file" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="file-upload">Comprovante (Opcional)</FormLabel><Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName}><CardContent className="p-4"><AnimatePresence>{selectedFileName && ( <motion.div key={selectedFileName} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4"><div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50"><div className="flex items-center gap-2 min-w-0"><FileText className="h-5 w-5 flex-shrink-0 text-primary" /><div className="flex flex-col min-w-0"><span className="text-sm font-medium truncate" title={selectedFileName}>{selectedFileName}</span>{selectedFileSize !== null && (<span className="text-xs text-muted-foreground">{(selectedFileSize / 1024 / 1024).toFixed(2)} MB</span>)}</div></div><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFile(field.onChange)} disabled={isSubmitting} aria-label="Remover"><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Remover</p></TooltipContent></Tooltip></div></motion.div> )}</AnimatePresence><label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md", isSubmitting ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50", selectedFileName ? 'border-primary/30' : 'border-dashed border-2')}><Upload className="h-8 w-8 text-muted-foreground mb-2" /><span className="text-sm text-primary font-medium">{selectedFileName ? 'Selecionar outro arquivo' : 'Selecionar arquivo'}</span><span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span><span className="text-xs text-muted-foreground mt-2">Imagem ou PDF (máx. {MAX_FILE_SIZE_MB}MB)</span><FormControl><Input id="file-upload" type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(',')} disabled={isSubmitting} ref={field.ref} name={field.name} onBlur={field.onBlur} onChange={(e) => handleFileSelect(e, field.onChange)} /></FormControl></label><FormMessage className="mt-2" /></CardContent></Card></FormItem>
                   )} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
                <Button variant="outline" type="button" onClick={() => router.back()} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first"><Ban className="mr-2 h-4 w-4"/> Cancelar</Button>
                <Button type="submit" disabled={isSubmitting || dropdownEmpreendimentos.length === 0 || !form.formState.isValid} className="w-full sm:w-auto">{isSubmitting ? ( <span className="flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</span> ) : ( <><Save className="mr-2 h-4 w-4"/> Salvar Despesa</> )}</Button>
              </div>
            </form>
          </Form>
        </motion.div>
      )}
    </TooltipProvider>
  );
}