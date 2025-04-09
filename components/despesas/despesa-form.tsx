// components/despesas/despesa-form.tsx
// Refatorado para corrigir aninhamento de <button>, usar API Route /api/upload-drive-despesa e adicionar toast de sucesso
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { useDespesas } from '@/hooks/useDespesas';
import type { CreateDespesaFormInput } from '@/lib/trpc/types';
import { trpc } from '@/lib/trpc/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';

// Interface Empreendimento com folderId opcional
interface EmpreendimentoOption {
  _id: string;
  name: string;
  folderId?: string | null;
}

const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Schema Zod para o formulário
const formSchema = z.object({
  description: z.string().min(3, { message: "Descrição: Mínimo 3 caracteres." }),
  value: z.coerce.number({ invalid_type_error: "Valor inválido." }).min(0.01, { message: "Valor deve ser maior que R$ 0,00." }),
  date: z.date({ required_error: "Data é obrigatória." }),
  dueDate: z.date({ required_error: "Vencimento é obrigatório." }),
  empreendimento: z.string().min(1, { message: "Empreendimento é obrigatório." }),
  status: z.enum(['Pago', 'Pendente', 'A vencer'], { errorMap: () => ({ message: "Status inválido (Pago, Pendente, A vencer)" }) }),
  category: z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'], { errorMap: () => ({ message: "Categoria inválida" }) }),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  file: z.any()
    .optional().nullable()
    .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), { message: "Selecione um arquivo válido." })
    .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
    .refine(file => !file || ACCEPTED_FILE_TYPES.includes(file?.type || ''), `Tipo inválido. Aceitos: JPG, PNG, GIF, PDF`),
}).refine(data => {
  try {
    const dateObj = data.date instanceof Date ? data.date : new Date(data.date);
    const dueDateObj = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
    return isValid(dateObj) && isValid(dueDateObj) && dueDateObj >= dateObj;
  } catch { return false; }
}, {
  message: "A data de vencimento não pode ser anterior à data da despesa.",
  path: ["dueDate"],
});

type DespesaFormValues = z.infer<typeof formSchema>;

export default function DespesaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedEmpreendimentoId = searchParams.get('empreendimento');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [isUploadingViaApiRoute, setIsUploadingViaApiRoute] = useState(false);
  const { toast } = useToast();

  const { empreendimentos: empreendimentoOptions, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();
  const { createDespesa, isCreating } = useDespesas();

  const form = useForm<DespesaFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      description: "", value: undefined, date: new Date(), dueDate: new Date(),
      empreendimento: preSelectedEmpreendimentoId ?? "", status: "Pendente", category: undefined,
      paymentMethod: "", notes: "", file: null,
    },
  });

  useEffect(() => {
    if (preSelectedEmpreendimentoId && !isLoadingEmpreendimentos && empreendimentoOptions.some(e => e._id === preSelectedEmpreendimentoId)) {
      form.setValue('empreendimento', preSelectedEmpreendimentoId);
    }
    if (!form.getValues('date')) form.setValue('date', new Date());
    if (!form.getValues('dueDate')) form.setValue('dueDate', new Date());
  }, [preSelectedEmpreendimentoId, isLoadingEmpreendimentos, empreendimentoOptions, form]);

  const onSubmit = useCallback(async (values: DespesaFormValues) => {
    let despesaCriadaId: string | undefined = undefined;
    setIsUploadingViaApiRoute(false);

    try {
      const { file, ...inputDataWithoutFile } = values;
      const inputData: CreateDespesaFormInput = {
        ...inputDataWithoutFile,
        date: values.date, dueDate: values.dueDate,
        paymentMethod: values.paymentMethod || undefined,
        notes: values.notes || undefined,
      };

      console.log("[onSubmit] Criando despesa...");
      const createdDespesaResult = await createDespesa(inputData);
      despesaCriadaId = createdDespesaResult.despesa?.id;
      console.log("[onSubmit] Resultado criação:", createdDespesaResult);

      if (!createdDespesaResult.success || !despesaCriadaId) {
        throw new Error("Falha ao criar a despesa.");
      }

      if (selectedFile) {
        console.log(`[onSubmit] Despesa ${despesaCriadaId} criada. Iniciando upload via API Route...`);
        setIsUploadingViaApiRoute(true);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('empreendimentoId', values.empreendimento);
        formData.append('despesaId', despesaCriadaId);
        formData.append('category', 'Despesas');

        const response = await fetch('/api/upload-drive-despesa', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Falha ao enviar anexo para o Google Drive');
        }

        const result = await response.json();
        console.log("[onSubmit] Upload concluído:", result);
        toast({
          title: "Sucesso",
          description: `Despesa salva e anexo "${selectedFile.name}" enviado com sucesso!`,
          variant: "default", // Ou "success" se sua biblioteca suportar
        });
      } else {
        // Toast de sucesso sem anexo
        toast({
          title: "Sucesso",
          description: "Despesa salva com sucesso!",
          variant: "default", // Ou "success" se sua biblioteca suportar
        });
      }

      form.reset();
      removeFileInternal(true);
      router.push('/dashboard/despesas');
      router.refresh();

    } catch (error) {
      console.error("Erro no onSubmit:", error);
      setIsUploadingViaApiRoute(false);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error instanceof Error
          ? despesaCriadaId
            ? `Despesa salva, mas falha no anexo: ${error.message}. Edite para tentar novamente.`
            : `Falha ao salvar a despesa: ${error.message}`
          : "Ocorreu um problema ao processar a despesa.",
        duration: 8000,
      });
    }
  }, [createDespesa, form, router, toast, selectedFile, empreendimentoOptions]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    form.setValue('file', file, { shouldValidate: true, shouldDirty: true });
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) { toast({ variant: "destructive", title: "Erro", description: `Arquivo ${file.name} excede ${MAX_FILE_SIZE_MB}MB.` }); removeFileInternal(true); return; }
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) { toast({ variant: "destructive", title: "Erro", description: `Tipo inválido (${file.name}). Aceitos: JPG, PNG, GIF, PDF.` }); removeFileInternal(true); return; }
      setSelectedFile(file); setSelectedFileName(file.name); setSelectedFileSize(file.size);
    } else { removeFileInternal(false); }
  };

  const removeFileInternal = (clearInput = true) => {
    setSelectedFile(null); setSelectedFileName(null); setSelectedFileSize(null);
    form.resetField('file', { defaultValue: null });
    if (clearInput) { const fi = document.getElementById('file-upload') as HTMLInputElement | null; if (fi) fi.value = ''; }
  };

  const isSubmittingOrLoading = isCreating || isLoadingEmpreendimentos || isUploadingViaApiRoute;

  if (isLoadingEmpreendimentos) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
        <div className="flex items-center gap-3 sm:gap-4 border-b pb-4"> <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" /> <div className="space-y-1.5 flex-grow"> <Skeleton className="h-6 w-40 sm:w-48" /> <Skeleton className="h-4 w-3/4 sm:w-2/3" /> </div> </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"> <div className="space-y-6"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <div className="grid grid-cols-2 gap-4"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> </div> <Skeleton className="h-16 w-full" /> </div> <div className="space-y-6"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-24 w-full" /> <Skeleton className="h-40 w-full" /> </div> </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t"> <Skeleton className="h-10 w-full sm:w-24 order-last sm:order-first" /> <Skeleton className="h-10 w-full sm:w-32" /> </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8"
      >
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                disabled={isSubmittingOrLoading}
                asChild
              >
                <Link href="/dashboard/despesas" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Voltar para Lista</p>
            </TooltipContent>
          </Tooltip>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Nova Despesa</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Registre um novo gasto ou pagamento.</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              {/* Coluna Esquerda */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="empreendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Empreendimento <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmittingOrLoading}
                        required
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingEmpreendimentos ? "Carregando..." : "Selecione"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(empreendimentoOptions || []).map((emp: EmpreendimentoOption) => (
                            <SelectItem key={emp._id} value={emp._id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                          {(!empreendimentoOptions || empreendimentoOptions.length === 0) &&
                            !isLoadingEmpreendimentos && (
                              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                                Nenhum empreendimento encontrado.
                              </div>
                            )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Descrição <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Compra de cimento (NF 123)"
                          {...field}
                          disabled={isSubmittingOrLoading}
                          aria-required="true"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Valor (R$) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="150.50"
                          {...field}
                          value={field.value === undefined || isNaN(field.value) ? '' : field.value}
                          onChange={e =>
                            field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))
                          }
                          disabled={isSubmittingOrLoading}
                          aria-required="true"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          Data <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-9",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isSubmittingOrLoading}
                                aria-required="true"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                  : <span>Selecione</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={isSubmittingOrLoading}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          Vencimento <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-9",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isSubmittingOrLoading}
                                aria-required="true"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                  : <span>Selecione</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={isSubmittingOrLoading}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Status <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmittingOrLoading}
                        required
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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

              {/* Coluna Direita */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Categoria <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmittingOrLoading}
                        required
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pagamento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Boleto Banco X, Cartão Final 1234"
                          {...field}
                          value={field.value ?? ''}
                          disabled={isSubmittingOrLoading}
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1 text-xs">
                        <Info className="h-3 w-3" />
                        Opcional.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detalhes adicionais..."
                          className="min-h-[100px] resize-y"
                          {...field}
                          value={field.value ?? ''}
                          disabled={isSubmittingOrLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Input de Arquivo */}
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="file-upload">Anexo (Opcional)</FormLabel>
                      <Card
                        className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50"
                        data-has-file={!!selectedFileName}
                      >
                        <CardContent className="p-4">
                          <AnimatePresence>
                            {selectedFileName && (
                              <motion.div
                                key={selectedFileName}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-primary/5 mb-4">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                                    <div className="flex flex-col min-w-0">
                                      <span
                                        className="text-sm font-medium truncate"
                                        title={selectedFileName}
                                      >
                                        {selectedFileName}
                                      </span>
                                      {selectedFileSize !== null && (
                                        <span className="text-xs text-muted-foreground">
                                          {(selectedFileSize / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                                        onClick={() => removeFileInternal(true)}
                                        disabled={isSubmittingOrLoading}
                                        aria-label="Remover arquivo"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remover arquivo</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <label
                            htmlFor="file-upload"
                            className={cn(
                              "flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md",
                              isSubmittingOrLoading
                                ? "cursor-not-allowed opacity-60 bg-muted/20"
                                : "hover:bg-muted/50",
                              selectedFileName ? 'border-primary/30' : 'border-dashed border-2'
                            )}
                          >
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-primary font-medium">
                              {selectedFileName ? 'Selecionar outro' : 'Selecionar anexo'}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1">
                              ou arraste e solte
                            </span>
                            <span className="text-xs text-muted-foreground mt-2">
                              JPG, PNG, GIF, PDF (máx. {MAX_FILE_SIZE_MB}MB)
                            </span>
                          </label>

                          <FormControl>
                            <Input
                              id="file-upload"
                              type="file"
                              className="hidden"
                              accept={ACCEPTED_FILE_TYPES.join(',')}
                              disabled={isSubmittingOrLoading}
                              onChange={(e) => {
                                handleFileSelect(e);
                                field.onChange(e.target.files?.[0] ?? null);
                              }}
                              ref={field.ref}
                            />
                          </FormControl>

                          <FormMessage className="mt-2" />
                        </CardContent>
                      </Card>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
              <Button variant="outline" type="button" asChild disabled={isSubmittingOrLoading} className="w-full sm:w-auto order-last sm:order-first">
                <Link href="/dashboard/despesas"><Ban className="mr-2 h-4 w-4" /> Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isSubmittingOrLoading || !form.formState.isValid} className="w-full sm:w-auto">
                {isSubmittingOrLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isUploadingViaApiRoute ? 'Enviando Anexo...' : 'Salvando...'}
                  </span>
                ) : (
                  <> <Save className="mr-2 h-4 w-4" /> Salvar Despesa </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </TooltipProvider>
  );
}