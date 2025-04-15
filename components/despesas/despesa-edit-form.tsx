// ============================================================
// ARQUIVO CORRIGIDO: components/despesas/despesa-edit-form.tsx
// (Campo Método de Pagamento dinâmico com Select + Input)
// ============================================================
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react"; // Adicionado useState, useEffect
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban, Eye, Trash2, Building, ClipboardList, Shapes, AlertCircle
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
import { useUiConfig } from '@/hooks/useUiConfig'; // Importar hook UI Config
import type { DynamicUIConfigFieldInput } from '@/server/api/schemas/uiConfig'; // Importar tipo do field config
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Import Alert
import mongoose from 'mongoose';

// --- Constantes e Tipos ---
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
// *** Opções do Select Método Pagamento ***
const PAYMENT_METHOD_OPTIONS = [
    "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "PIX",
    "Boleto Bancário", "Transferência", "Outros"
];

// --- Função para Gerar Schema Dinâmico (Inalterada, mas usada aqui) ---
const generateDynamicDespesaSchema = (getFieldConfig: (fieldName: string) => DynamicUIConfigFieldInput | undefined) => {
     const getValidationRule = (fieldName: string, defaultRule: z.ZodTypeAny, isRequiredByDefault: boolean) => {
        const config = getFieldConfig(fieldName);
        const isRequired = config?.required ?? isRequiredByDefault;
        const isVisible = config?.visible ?? true;
        if (!isVisible) { return defaultRule.optional().nullable(); }
        let rule = defaultRule;
        if (isRequired) {
            if (rule instanceof z.ZodString) rule = rule.min(1, { message: "Campo obrigatório" });
            else if (rule instanceof z.ZodNumber) rule = rule.min(0.01, { message: "Valor deve ser maior que 0" });
            else if (rule instanceof z.ZodDate) rule = rule.refine(val => val !== null && val !== undefined, { message: "Campo obrigatório" });
            else if (rule instanceof z.ZodEnum) rule = rule.refine(val => val !== null && val !== undefined, { message: "Seleção obrigatória" });
        } else {
            rule = rule.optional().nullable();
        }
        return rule;
    };
    // Define a estrutura base do schema (campos que podem ser editados)
    const dynamicShape = {
        description: getValidationRule('description', z.string().trim().min(2, { message: 'Mínimo 2 caracteres' }), true),
        value: getValidationRule('value', z.coerce.number({ invalid_type_error: "Valor inválido." }).positive({message: "Valor deve ser positivo"}), true),
        date: getValidationRule('date', z.date({ required_error: "Data é obrigatória." }), true),
        dueDate: getValidationRule('dueDate', z.date({ required_error: "Vencimento é obrigatório." }), true),
        status: getValidationRule('status', z.enum(['Pago', 'Pendente', 'A vencer', 'Rejeitado']), true), // Pode editar status
        category: getValidationRule('category', z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros']), true),
        paymentMethod: getValidationRule('paymentMethod', z.string().trim(), false),
        notes: getValidationRule('notes', z.string().trim(), false),
        file: z.any() // Campo para novo upload
            .optional().nullable()
            .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), { message: "Selecione um arquivo válido." })
            .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
            .refine(file => !file || ACCEPTED_FILE_TYPES.includes(file?.type || ''), `Tipo inválido: ${ACCEPTED_FILE_TYPES.join(', ')}`),
        empreendimentoName: z.string().optional(), // Readonly, mas precisa estar no schema se renderizado
    };
    return z.object(dynamicShape).refine(data => {
         const dateVisible = getFieldConfig('date')?.visible ?? true;
         const dueDateVisible = getFieldConfig('dueDate')?.visible ?? true;
         if (!dateVisible || !dueDateVisible) return true;
         if (data.dueDate && data.date && isValid(data.dueDate) && isValid(data.date)) { return data.dueDate >= data.date; }
         return true;
     }, { message: "A data de vencimento não pode ser anterior à data da despesa.", path: ["dueDate"], });
};
// Tipo para os valores do formulário
type DespesaFormData = z.infer<ReturnType<typeof generateDynamicDespesaSchema>>;


// --- Componente Auxiliar para Renderizar Campos (Inalterado no código, mas a lógica interna do 'paymentMethod' será movida) ---
// A lógica complexa do paymentMethod será movida para dentro do render do FormField principal.
const RenderFormField = React.memo(({
    fieldConfig, control, getLabel, isProcessing, handleFileChange, removeFileInternal,
    selectedFileName, selectedFileSize, existingAttachments, removeExistingAttachment,
    // Props do paymentMethod não são mais necessárias aqui
}: {
    fieldConfig: DynamicUIConfigFieldInput; control: any; getLabel: (originalLabel: string, fallbackLabel?: string) => string;
    isProcessing: boolean; handleFileChange: (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => void;
    removeFileInternal: (fieldOnChange: (...event: any[]) => void) => void; selectedFileName: string | null;
    selectedFileSize: number | null; existingAttachments: Attachment[];
    removeExistingAttachment: (fieldOnChange: (...event: any[]) => void, attachmentInfo: { id?: string; fileId?: string }) => void;
}) => {
    const fieldName = fieldConfig.fieldName as keyof DespesaFormData;
    const label = getLabel(fieldName, fieldConfig.label);
    const isRequired = fieldConfig.required;
    const normalizedFieldName = (fieldName as string) === 'attachments' ? 'file' : fieldName;

    // *** NÃO RENDERIZA paymentMethod aqui ***
    if (!fieldConfig.visible || normalizedFieldName === 'paymentMethod') {
        return null;
    }

    return (
        <FormField
            control={control}
            name={normalizedFieldName}
            render={({ field }) => (
                <FormItem className={normalizedFieldName === 'notes' || normalizedFieldName === 'file' ? "col-span-1 md:col-span-2" : ""}>
                    <FormLabel>{label} {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                    <FormControl>
                         {normalizedFieldName === 'empreendimentoName' ? ( <Input {...field} value={field.value ?? ""} readOnly disabled className="bg-muted/50 cursor-not-allowed border-2" />
                         ) : normalizedFieldName === 'description' ? ( <Input placeholder={getLabel('Placeholder Descrição', "Ex: Compra de cimento (NF 123)")} {...field} value={field.value ?? ""} disabled={isProcessing} aria-required={isRequired} className="border-2" />
                         ) : normalizedFieldName === 'value' ? ( <Input type="number" step="0.01" min="0.01" placeholder={getLabel('Placeholder Valor', "150.50")} {...field} value={field.value === undefined ? '' : field.value} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} disabled={isProcessing} aria-required={isRequired} className="border-2" />
                         ) : normalizedFieldName === 'date' || normalizedFieldName === 'dueDate' ? ( <Popover> <PopoverTrigger asChild> <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 border-2", !field.value && "text-muted-foreground")} disabled={isProcessing} aria-required={isRequired}> <CalendarIcon className="mr-2 h-4 w-4" /> {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>} </Button> </PopoverTrigger> <PopoverContent className="w-auto p-0" align="start"> <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isProcessing} initialFocus /> </PopoverContent> </Popover>
                         ) : normalizedFieldName === 'status' ? ( <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing} required={isRequired} aria-required={isRequired}> <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary h-10"> <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Selecione" /></div> </SelectTrigger> <SelectContent><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="A vencer">A vencer</SelectItem><SelectItem value="Rejeitado">Rejeitado</SelectItem></SelectContent> </Select>
                         ) : normalizedFieldName === 'category' ? ( <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing} required={isRequired} aria-required={isRequired}> <SelectTrigger className="w-full bg-background border-2 hover:border-primary focus:ring-2 focus:ring-primary h-10"> <div className="flex items-center gap-2"><Shapes className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Selecione" /></div> </SelectTrigger> <SelectContent><SelectItem value="Material">Material</SelectItem><SelectItem value="Serviço">Serviço</SelectItem><SelectItem value="Equipamento">Equipamento</SelectItem><SelectItem value="Taxas">Taxas</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent> </Select>
                         // paymentMethod tratado fora
                         ) : normalizedFieldName === 'notes' ? ( <Textarea placeholder={getLabel('Placeholder Observações', "Detalhes adicionais...")} className="min-h-[100px] resize-y border-2" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value || null)} disabled={isProcessing} />
                         ) : normalizedFieldName === 'file' ? (
                             <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName || existingAttachments.length > 0}>
                                 <CardContent className="p-4">
                                     {/* Mostrar Anexo Existente (se houver) */}
                                      {existingAttachments.map((att) => ( <div key={att.fileId || att._id} className="mb-4 space-y-2"> <p className="text-sm font-medium text-muted-foreground">Anexo atual:</p> <div className="flex items-center justify-between p-2 border rounded-md bg-muted/30"> <div className="flex items-center gap-2 min-w-0"> <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> <span className="text-sm truncate" title={att.name}>{att.name || 'Nome indisponível'}</span> </div> <div className="flex items-center gap-1"> {att.url && ( <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" asChild><a href={att.url} target="_blank" rel="noopener noreferrer" aria-label="Visualizar anexo atual"><Eye className="h-4 w-4" /></a></Button></TooltipTrigger><TooltipContent><p>Visualizar</p></TooltipContent></Tooltip> )} <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => removeExistingAttachment(field.onChange, { id: att._id?.toString(), fileId: att.fileId })} disabled={isProcessing} aria-label="Remover anexo atual"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Remover ao Salvar</p></TooltipContent></Tooltip> </div> </div> </div> ))}
                                      {/* Preview do Novo Anexo (se selecionado) */}
                                      <AnimatePresence>{selectedFileName && ( <motion.div key={selectedFileName} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4"> <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-primary/5"> <div className="flex items-center gap-2 min-w-0"> <FileText className="h-5 w-5 flex-shrink-0 text-primary" /> <div className="flex flex-col min-w-0"> <span className="text-sm font-medium truncate" title={selectedFileName}>{selectedFileName}</span> {selectedFileSize !== null && (<span className="text-xs text-muted-foreground">{(selectedFileSize / 1024 / 1024).toFixed(2)} MB</span>)} </div> </div> <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFileInternal(field.onChange)} disabled={isProcessing} aria-label="Remover seleção"><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Remover seleção</p></TooltipContent></Tooltip> </div> </motion.div> )}</AnimatePresence>
                                      {/* Área de Upload (se não houver anexo existente ou novo) */}
                                      {existingAttachments.length === 0 && !selectedFileName && ( <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-md", isProcessing ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50", 'border-dashed border-2')}> <Upload className="h-8 w-8 text-muted-foreground mb-2" /> <span className="text-sm text-primary font-medium">Selecionar Anexo</span> <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span> <span className="text-xs text-muted-foreground mt-2">{ACCEPTED_FILE_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')} (máx. {MAX_FILE_SIZE_MB}MB)</span> </label> )}
                                     <Input id="file-upload" type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(',')} disabled={isProcessing} ref={field.ref} name={field.name} onBlur={field.onBlur} onChange={(e) => handleFileChange(e, field.onChange)} />
                                 </CardContent>
                             </Card>
                         ) : null}
                    </FormControl>
                    {/* Descrições */}
                     {normalizedFieldName === 'empreendimentoName' && (<FormDescription className="text-xs">Este campo não pode ser alterado.</FormDescription>)}
                    {/* Removido FormDescription de paymentMethod daqui */}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
});
RenderFormField.displayName = 'RenderFormField';


// --- Componente Principal (Editar) ---
export default function DespesaEditForm({ id }: { id: string }) {
  // Estados locais (mantidos, adicionado isOtherPaymentMethod)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<Attachment[]>([]);
  const [isUploadingViaApiRoute, setIsUploadingViaApiRoute] = useState(false);
  const [removedAttachmentInfo, setRemovedAttachmentInfo] = useState<{ id?: string; fileId?: string } | null>(null);
  // *** NOVO ESTADO para input "Outros" ***
  const [isOtherPaymentMethod, setIsOtherPaymentMethod] = useState(false);

  // Hooks (mantidos)
  const router = useRouter();
  const { toast } = useToast();
  const { getDespesaById, updateDespesa, isUpdating } = useDespesas();
  const { data: initialDespesaData, isLoading: isLoadingData, error: loadingError, isFetching } = getDespesaById(id);
  const { config, isLoading: isLoadingConfig, getLabel, getFieldConfig, getVisibleFields, error: uiConfigError } = useUiConfig('despesas');

  // Estado do schema dinâmico (mantido)
  const [dynamicSchema, setDynamicSchema] = useState(() => generateDynamicDespesaSchema(() => undefined));

  // Inicialização do Form (mantido)
  const form = useForm<DespesaFormData>({
    resolver: zodResolver(dynamicSchema),
    mode: "onChange",
    defaultValues: { /* ... valores padrão ... */ description: "", value: 0, date: new Date(), dueDate: new Date(), status: "Pendente", category: "Outros", paymentMethod: null, notes: null, file: null, empreendimentoName: "", },
  });

  // Efeito para gerar e aplicar o schema dinâmico (mantido)
  useEffect(() => {
    if (config && !isLoadingConfig) {
      console.log("[DespesaEditForm] Config carregada, gerando schema dinâmico.");
      const newSchema = generateDynamicDespesaSchema(getFieldConfig);
      setDynamicSchema(newSchema);
      const currentValues = form.getValues();
      form.reset(currentValues, { resolver: zodResolver(newSchema), keepValues: true, keepDirty: form.formState.isDirty, keepErrors: true, });
      console.log("[DespesaEditForm] Schema dinâmico aplicado ao form.");
    }
  }, [config, isLoadingConfig, getFieldConfig, form]);

  // Efeito para popular o formulário com dados iniciais (AJUSTADO)
  useEffect(() => {
    if (isLoadingData || isFetching || loadingError || !initialDespesaData) return;
    console.log("[DespesaEditForm] Initial Data:", initialDespesaData);
    try {
      const parsedDate = safeParseDate(initialDespesaData.date) ?? new Date();
      const parsedDueDate = safeParseDate(initialDespesaData.dueDate) ?? new Date();
      const validStatus = z.enum(['Pago', 'Pendente', 'A vencer', 'Rejeitado']).safeParse(initialDespesaData.status).success ? initialDespesaData.status : "Pendente";
      const validCategory = z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros']).safeParse(initialDespesaData.category).success ? initialDespesaData.category : "Outros";

      form.reset({
        description: initialDespesaData.description || "", value: initialDespesaData.value ?? 0,
        date: parsedDate, dueDate: parsedDueDate, status: validStatus, category: validCategory,
        paymentMethod: initialDespesaData.paymentMethod ?? null, // Preenche com valor existente
        notes: initialDespesaData.notes ?? null, file: null,
        empreendimentoName: initialDespesaData.empreendimento?.name || "Não encontrado",
      }, { keepDefaultValues: false });

      form.setValue("status", validStatus, { shouldValidate: true });
      form.setValue("category", validCategory, { shouldValidate: true });

      setExistingAttachments((initialDespesaData.attachments ?? []).filter((att): att is Attachment => typeof att.fileId === 'string' && typeof att.name === 'string'));
      setRemovedAttachmentInfo(null);

      // *** NOVO: Verifica valor inicial de paymentMethod ***
      const initialPaymentMethod = initialDespesaData.paymentMethod;
      if (initialPaymentMethod && !PAYMENT_METHOD_OPTIONS.includes(initialPaymentMethod)) {
           console.log(`[DespesaEditForm] Método de pagamento inicial '${initialPaymentMethod}' não está nas opções. Habilitando 'Outros'.`);
           setIsOtherPaymentMethod(true);
           // O valor já está no form.setValue acima
      } else {
           setIsOtherPaymentMethod(false);
           // Garante que o Select reflita a opção pré-definida ou fique vazio se for null/undefined
           form.setValue("paymentMethod", initialPaymentMethod || null);
           console.log(`[DespesaEditForm] Método de pagamento inicial: ${initialPaymentMethod || 'Nenhum'}. 'Outros' desabilitado.`);
      }

    } catch (error) { console.error("[DespesaEditForm] Error processing data:", error); toast({ variant: "destructive", title: "Erro ao Carregar Dados", description: "Não foi possível preencher o formulário." }); }
  }, [initialDespesaData, isLoadingData, isFetching, loadingError, form, toast]);

  // Lógica de Submit (mantida)
  const onSubmit = useCallback(async (values: DespesaFormData) => { /* ... (lógica de submit inalterada) ... */ if (!initialDespesaData || !initialDespesaData.empreendimento?._id) { toast({ variant: "destructive", title: "Erro", description: "Dados originais ou ID do empreendimento ausentes." }); return; } const empreendimentoIdParaUpload = initialDespesaData.empreendimento._id; let apiRouteUploadResult: { success: boolean; fileId?: string; fileName?: string; url?: string; error?: string } | null = null; setIsUploadingViaApiRoute(false); try { const newFile = values.file as File | null; if (newFile instanceof File) { setIsUploadingViaApiRoute(true); const formData = new FormData(); formData.append('file', newFile); formData.append('empreendimentoId', empreendimentoIdParaUpload); formData.append('despesaId', id); formData.append('category', values.category || 'Despesas'); const uploadResponse = await fetch('/api/upload-drive-despesa', { method: 'POST', body: formData }); apiRouteUploadResult = await uploadResponse.json(); if (!uploadResponse.ok || !apiRouteUploadResult?.success) { throw new Error(apiRouteUploadResult?.error || 'Falha ao enviar novo anexo'); } setRemovedAttachmentInfo(null); setIsUploadingViaApiRoute(false); } const dataToUpdate: Partial<UpdateDespesaFormInput> = {}; let hasChanges = false; (Object.keys(values) as Array<keyof DespesaFormData>).forEach(key => { if (key === 'file' || key === 'empreendimentoName') return; const formValue = values[key]; const originalValue = (initialDespesaData as any)[key]; let valueChanged = false; if (formValue instanceof Date && originalValue) { const originalDate = safeParseDate(originalValue); valueChanged = !originalDate || formValue.toISOString() !== originalDate.toISOString(); } else if (typeof formValue === 'number' && typeof originalValue === 'number') { valueChanged = formValue !== originalValue; } else { const formString = formValue === null ? null : String(formValue ?? '').trim(); const originalString = originalValue === null ? null : String(originalValue ?? '').trim(); valueChanged = formString !== originalString; } if (valueChanged) { (dataToUpdate as any)[key] = (key === 'date' || key === 'dueDate') ? (formValue as Date).toISOString() : formValue; hasChanges = true; } }); if (apiRouteUploadResult?.success && apiRouteUploadResult.fileId) { dataToUpdate.attachments = [{ fileId: apiRouteUploadResult.fileId, name: apiRouteUploadResult.fileName, url: apiRouteUploadResult.url, }]; hasChanges = true; } else if (removedAttachmentInfo) { dataToUpdate.attachments = null; hasChanges = true; } if (!hasChanges) { toast({ title: "Nenhuma alteração", description: "Nenhuma mudança detectada." }); return; } await updateDespesa(id, dataToUpdate as UpdateDespesaFormInput); toast({ title: "Sucesso", description: "Despesa atualizada com sucesso!" }); setSelectedFile(null); setSelectedFileName(null); setSelectedFileSize(null); setRemovedAttachmentInfo(null); router.push(`/dashboard/despesas/${id}`); router.refresh(); } catch (error) { console.error("[DespesaEditForm] Submit Error:", error); setIsUploadingViaApiRoute(false); toast({ variant: "destructive", title: "Erro ao Salvar", description: error instanceof Error ? error.message : "Erro ao salvar alterações.", }); } }, [id, router, toast, form, updateDespesa, initialDespesaData, removedAttachmentInfo]);

  // Handlers de Arquivo (mantidos)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (...event: any[]) => void) => { /* ... (lógica inalterada) ... */ const file = e.target.files?.[0] ?? null; form.setValue('file', file, { shouldValidate: true, shouldDirty: true }); setRemovedAttachmentInfo(null); setTimeout(() => { const fieldState = form.getFieldState('file'); if (file && !fieldState.error) { setSelectedFile(file); setSelectedFileName(file.name); setSelectedFileSize(file.size); } else { removeFileInternal(fieldOnChange, true); if (fieldState.error) { toast({ variant: "destructive", title: "Erro", description: fieldState.error.message }); } } }, 50); };
  const removeFileInternal = (fieldOnChange: (...event: any[]) => void, clearInput = true) => { /* ... (lógica inalterada) ... */ fieldOnChange(null); setSelectedFile(null); setSelectedFileName(null); setSelectedFileSize(null); form.clearErrors("file"); if (clearInput) { const fi = document.getElementById('file-upload') as HTMLInputElement | null; if (fi) fi.value = ''; } };
  // Handler específico para remover anexo existente
  const removeExistingAttachment = (fieldOnChange: (...event: any[]) => void, attachmentInfo: { id?: string; fileId?: string }) => {
     removeFileInternal(fieldOnChange, false); // Limpa seleção atual, mas não input visual
     setRemovedAttachmentInfo(attachmentInfo); // Marca para remoção no submit
     setExistingAttachments(prev => prev.filter(att => (att._id || att.fileId) !== (attachmentInfo.id || attachmentInfo.fileId))); // Remove da UI
     form.setValue('file', undefined, { shouldDirty: true }); // Marca formulário como 'dirty'
  };

  // Estado de Carregamento e Erro (mantido)
  const isSubmitting = isUpdating || isUploadingViaApiRoute || isLoadingConfig;
  if (isLoadingData || isFetching || isLoadingConfig) { return ( <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse"> <div className="flex items-center gap-3 sm:gap-4 border-b pb-4"> <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" /> <div className="space-y-1.5 flex-grow"> <Skeleton className="h-6 w-3/4 sm:w-1/2" /> <Skeleton className="h-4 w-1/2 sm:w-1/3" /> </div> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> <div className="space-y-6"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> </div> <div className="space-y-6"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-24 w-full" /> <Skeleton className="h-40 w-full" /> </div> </div> <div className="flex justify-end gap-4"> <Skeleton className="h-10 w-24" /> <Skeleton className="h-10 w-28" /> </div> </div> ); }
  if (loadingError) { return <div className="p-6 text-center text-destructive">Erro ao carregar dados: {loadingError.message}</div>; }
  if (!initialDespesaData) { return <div className="p-6 text-center text-muted-foreground">Despesa não encontrada.</div>; }
  if (uiConfigError && (uiConfigError as any)?.data?.code !== 'NOT_FOUND') { return ( <Alert variant="destructive" className="m-4 sm:m-6 lg:m-8 max-w-4xl mx-auto"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Erro Configuração</AlertTitle> <AlertDescription>Não foi possível carregar configurações. Tente recarregar.</AlertDescription> </Alert> ); }

  // Obter campos visíveis (mantido)
  let visibleFields = getVisibleFields();
  if (!visibleFields.some(field => field.fieldName === 'file' || field.fieldName === 'attachments')) { visibleFields = [...visibleFields, { fieldName: 'file', label: 'Anexo', required: false, visible: true, order: 99 } as DynamicUIConfigFieldInput]; }
  visibleFields = visibleFields.map(field => field.fieldName === 'attachments' ? { ...field, fieldName: 'file' } : field);

  return (
      <TooltipProvider>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
              {/* Header (mantido) */}
              <div className="flex items-center gap-3 sm:gap-4 border-b pb-4"> <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" asChild disabled={isSubmitting}><Link href={`/dashboard/despesas/${id}`} aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link></Button></TooltipTrigger><TooltipContent><p>Voltar para Detalhes</p></TooltipContent></Tooltip> <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">{getLabel('Editar Despesa', 'Editar Despesa')}</h2><p className="text-muted-foreground text-sm sm:text-base">{getLabel('Descrição Editar Despesa', 'Atualize as informações.')}</p></div> </div>

              <FormProvider {...form}>
                  <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                               {visibleFields.map((fieldConfig) => {
                                    // *** Tratamento Especial para 'paymentMethod' ***
                                    if (fieldConfig.fieldName === 'paymentMethod') {
                                        if (!fieldConfig.visible) return null; // Não renderiza se invisível
                                        const label = getLabel('paymentMethod', fieldConfig.label);
                                        const isRequired = fieldConfig.required;
                                        return (
                                            <FormField
                                                key="paymentMethod"
                                                control={form.control}
                                                name="paymentMethod"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{label} {isRequired && <span className="text-destructive">*</span>}</FormLabel>
                                                        <Select
                                                            onValueChange={(value) => {
                                                                const isOther = value === 'Outros';
                                                                // Se selecionar 'Outros', limpa o valor para o input assumir.
                                                                // Se selecionar opção, define o valor. Se deselecionar, define null.
                                                                field.onChange(isOther ? '' : value || null);
                                                                setIsOtherPaymentMethod(isOther);
                                                            }}
                                                            // Valor do select: 'Outros' se o estado for true, senão o valor do campo
                                                            value={isOtherPaymentMethod ? 'Outros' : field.value ?? ""}
                                                            disabled={isSubmitting}
                                                            required={isRequired && !isOtherPaymentMethod}
                                                        >
                                                            <FormControl><SelectTrigger><SelectValue placeholder={getLabel('Placeholder Método Pag.', "Selecione")} /></SelectTrigger></FormControl>
                                                            <SelectContent>{PAYMENT_METHOD_OPTIONS.map(option => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                        {/* Input condicional para 'Outros' */}
                                                        <AnimatePresence>
                                                            {isOtherPaymentMethod && (
                                                                <motion.div
                                                                    key="other-payment-input-edit"
                                                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                                    animate={{ opacity: 1, height: 'auto', marginTop: '0.5rem' }}
                                                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                >
                                                                    <FormControl>
                                                                        <Input
                                                                            placeholder={getLabel('Placeholder Outro Método', "Digite o método")}
                                                                            // Input controla diretamente o campo 'paymentMethod' quando visível
                                                                            value={field.value ?? ''} // Mostra o valor customizado
                                                                            onChange={(e) => field.onChange(e.target.value || null)} // Atualiza direto
                                                                            disabled={isSubmitting}
                                                                            required={isRequired && isOtherPaymentMethod}
                                                                        />
                                                                    </FormControl>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                        {!isRequired && (<FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" />{getLabel('Desc Método Pag.', 'Opcional.')}</FormDescription>)}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        );
                                    }
                                    // Renderiza outros campos
                                    return (
                                        <RenderFormField
                                            key={fieldConfig.fieldName}
                                            fieldConfig={fieldConfig}
                                            control={form.control}
                                            getLabel={getLabel}
                                            isProcessing={isSubmitting} // Passa isSubmitting para desabilitar
                                            handleFileChange={handleFileSelect}
                                            removeFileInternal={removeFileInternal}
                                            selectedFileName={selectedFileName}
                                            selectedFileSize={selectedFileSize}
                                            existingAttachments={existingAttachments}
                                            removeExistingAttachment={removeExistingAttachment}
                                            // Props não necessárias (estão fora do componente auxiliar agora)
                                            empreendimentoOptions={[]}
                                            isLoadingEmpreendimentos={false}
                                            preSelectedEmpreendimentoId={null}
                                        />
                                    );
                                })}
                          </div>

                          {/* Botões de Ação (mantidos) */}
                          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t"> <Button variant="outline" type="button" onClick={() => router.push(`/dashboard/despesas/${id}`)} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first"><Ban className="mr-2 h-4 w-4" /> {getLabel('Cancelar', 'Cancelar')}</Button> <Button type="submit" disabled={isSubmitting || isLoadingData || isFetching || (!form.formState.isDirty && !form.getValues('file') && !removedAttachmentInfo)} className="w-full sm:w-auto">{isSubmitting ? (<span className="flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingViaApiRoute ? getLabel('Enviando Anexo...', 'Enviando Anexo...') : getLabel('Salvando...', 'Salvando...')}</span>) : (<><Save className="mr-2 h-4 w-4" /> {getLabel('Salvar Alterações', 'Salvar Alterações')}</>)}</Button> </div>
                      </form>
                  </Form>
              </FormProvider>
          </motion.div>
      </TooltipProvider>
  );
}
// ============================================================
// FIM DO ARQUIVO CORRIGIDO
// ============================================================