// ============================================================
// ARQUIVO CORRIGIDO: components/despesas/despesa-form.tsx
// (Integração reativa com useUiConfig para validação e renderização dinâmica)
// ============================================================
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Adicionado useState, useEffect, useMemo
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Info, Save, Ban, Building, ClipboardList, Shapes, AlertCircle } from 'lucide-react';
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
import type { CreateDespesaInput, DespesaCategory, DespesaStatus } from '@/server/api/schemas/despesas';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DespesaFormSkeleton } from './despesa-form-skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { useUiConfig } from '@/hooks/useUiConfig'; // Importar hook UI Config
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Import Alert
import mongoose from 'mongoose';
import type { DynamicUIConfigFieldInput } from '@/server/api/schemas/uiConfig'; // Importar tipo do field config

// --- Constantes e Tipos ---
interface EmpreendimentoOption { _id: string; name: string; folderId?: string | null; }
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- Função para Gerar Schema Dinâmico ---
const generateDynamicDespesaSchema = (getFieldConfig: (fieldName: string) => DynamicUIConfigFieldInput | undefined) => {
    const getValidationRule = (fieldName: string, defaultRule: z.ZodTypeAny, isRequiredByDefault: boolean) => {
        const config = getFieldConfig(fieldName);
        const isRequired = config?.required ?? isRequiredByDefault; // Usa config, fallback para default
        const isVisible = config?.visible ?? true; // Assume visível se não configurado

        // Se não for visível, não precisa ser validado como obrigatório, mas pode ter outras validações
        if (!isVisible) {
             // Retorna a regra base opcional/nula, ou uma regra mais permissiva
             // z.any() é muito permissivo, melhor usar optional/nullable se possível
             return defaultRule.optional().nullable();
        }

        let rule = defaultRule;
        if (isRequired) {
            // Aplica min(1) para strings apenas se for requerido
            if (rule instanceof z.ZodString) rule = rule.min(1, { message: "Campo obrigatório" });
            // Aplica validação de positivo apenas se for requerido
            else if (rule instanceof z.ZodNumber) rule = rule.min(0.01, { message: "Valor deve ser maior que 0" });
            // Garante que não seja null/undefined se requerido
            else if (rule instanceof z.ZodDate) rule = rule.refine(val => val !== null && val !== undefined, { message: "Campo obrigatório" });
            // Garante que enum seja selecionado se requerido
            else if (rule instanceof z.ZodEnum) rule = rule.refine(val => val !== null && val !== undefined, { message: "Seleção obrigatória" });
            // Garante ObjectId válido se requerido
            else if (fieldName === 'empreendimento' && rule instanceof z.ZodString) rule = rule.min(1, { message: "Campo obrigatório" }).refine(mongoose.isValidObjectId, { message: "ID inválido" });
        } else {
            // Torna opcional se não for requerido
            rule = rule.optional().nullable();
        }
        return rule;
    };

    // Define a estrutura base do schema
    const dynamicShape = {
        // Aplica regras dinâmicas a cada campo
        empreendimento: getValidationRule('empreendimento', z.string(), true),
        description: getValidationRule('description', z.string().trim().min(2, { message: 'Mínimo 2 caracteres' }), true),
        value: getValidationRule('value', z.coerce.number({ invalid_type_error: "Valor inválido." }).positive({message: "Valor deve ser positivo"}), true),
        date: getValidationRule('date', z.date({ required_error: "Data é obrigatória." }), true),
        dueDate: getValidationRule('dueDate', z.date({ required_error: "Vencimento é obrigatório." }), true),
        category: getValidationRule('category', z.enum(['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'], { errorMap: () => ({ message: "Categoria inválida" }) }), true),
        status: getValidationRule('status', z.enum(['Pago', 'Pendente', 'A vencer'], { errorMap: () => ({ message: "Status inválido" }) }), true),
        paymentMethod: getValidationRule('paymentMethod', z.string().trim(), false),
        notes: getValidationRule('notes', z.string().trim(), false),
        // Campo de arquivo (anexo) - sempre opcional no schema base Zod, validado no submit se 'attachments' for 'required'
        file: z.any()
            .optional().nullable()
            .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), { message: "Selecione um arquivo válido." })
            .refine(file => !file || file.size <= MAX_FILE_SIZE_BYTES, `Arquivo excede ${MAX_FILE_SIZE_MB}MB.`)
            .refine(file => !file || ACCEPTED_FILE_TYPES.includes(file?.type || ''), `Tipo inválido: ${ACCEPTED_FILE_TYPES.join(', ')}`),
    };

    // Adiciona refinamento global para datas, mas apenas se ambas forem visíveis e requeridas
    return z.object(dynamicShape).refine(data => {
        const dateVisible = getFieldConfig('date')?.visible ?? true;
        const dueDateVisible = getFieldConfig('dueDate')?.visible ?? true;
        if (!dateVisible || !dueDateVisible) return true; // Pula validação se um dos campos não for visível

        if (data.dueDate && data.date && isValid(data.dueDate) && isValid(data.date)) {
            return data.dueDate >= data.date;
        }
        // Se uma das datas for opcional e não preenchida, a validação passa
        return true;
    }, {
        message: "A data de vencimento não pode ser anterior à data da despesa.",
        path: ["dueDate"],
    });
};
// Tipo para os valores do formulário (gerado dinamicamente)
type DespesaFormValues = z.infer<ReturnType<typeof generateDynamicDespesaSchema>>;


// --- Componente Auxiliar para Renderizar Campos ---
const RenderFormField = React.memo(({ // Usar React.memo para otimizar
    fieldConfig,
    control,
    getLabel,
    isProcessing,
    empreendimentoOptions,
    isLoadingEmpreendimentos,
    preSelectedEmpreendimentoId,
    handleFileChange,
    removeFileInternal,
    selectedFileName,
    selectedFileSize,
}: {
    fieldConfig: DynamicUIConfigFieldInput;
    control: any;
    getLabel: (originalLabel: string, fallbackLabel?: string) => string;
    isProcessing: boolean;
    empreendimentoOptions: EmpreendimentoOption[];
    isLoadingEmpreendimentos: boolean;
    preSelectedEmpreendimentoId: string | null;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeFileInternal: (clearInput?: boolean) => void;
    selectedFileName: string | null;
    selectedFileSize: number | null;
}) => {
    const fieldName = fieldConfig.fieldName as keyof DespesaFormValues;
    const label = getLabel(fieldName, fieldConfig.label);
    const isRequired = fieldConfig.required;

    // Normalizar o fieldName para suportar 'attachments' como alias de 'file'
    const normalizedFieldName = (fieldName as string) === 'attachments' ? 'file' : fieldName;

    // Não renderiza nada se o campo não for visível
    if (!fieldConfig.visible) {
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
                        {/* Renderização Condicional Baseada no Campo */}
                        {normalizedFieldName === 'empreendimento' ? (
                            <Select
                                onValueChange={field.onChange}
                                value={field.value ?? ""}
                                disabled={isProcessing || !!preSelectedEmpreendimentoId}
                                required={isRequired}
                            >
                                <SelectTrigger className={cn("w-full", !!preSelectedEmpreendimentoId && "bg-muted/50")}>
                                    <div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder={isLoadingEmpreendimentos ? "Carregando..." : "Selecione"} /></div>
                                </SelectTrigger>
                                <SelectContent>{(empreendimentoOptions || []).map((emp) => (<SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>))}</SelectContent>
                            </Select>
                        ) : normalizedFieldName === 'description' ? (
                            <Input placeholder={getLabel('Placeholder Descrição', "Ex: Compra de cimento (NF 123)")} {...field} value={field.value ?? ""} disabled={isProcessing} />
                        ) : normalizedFieldName === 'value' ? (
                            <Input type="number" step="0.01" min="0.01" placeholder={getLabel('Placeholder Valor', "150.50")} {...field} value={field.value === undefined ? '' : field.value} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={isProcessing} />
                        ) : normalizedFieldName === 'date' || normalizedFieldName === 'dueDate' ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !field.value && "text-muted-foreground")} disabled={isProcessing}>
                                        <CalendarIcon className="mr-2 h-4 w-4" /> {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={isProcessing} initialFocus /></PopoverContent>
                            </Popover>
                        ) : normalizedFieldName === 'status' ? (
                            <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={isProcessing} required={isRequired}>
                                <SelectTrigger><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Selecione" /></div></SelectTrigger>
                                <SelectContent><SelectItem value="Pago">Pago</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="A vencer">A vencer</SelectItem></SelectContent>
                            </Select>
                        ) : normalizedFieldName === 'category' ? (
                            <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing} required={isRequired}>
                                <SelectTrigger><div className="flex items-center gap-2"><Shapes className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Selecione" /></div></SelectTrigger>
                                <SelectContent><SelectItem value="Material">Material</SelectItem><SelectItem value="Serviço">Serviço</SelectItem><SelectItem value="Equipamento">Equipamento</SelectItem><SelectItem value="Taxas">Taxas</SelectItem><SelectItem value="Outros">Outros</SelectItem></SelectContent>
                            </Select>
                        ) : normalizedFieldName === 'paymentMethod' ? (
                            <Input placeholder={getLabel('Placeholder Método Pag.', "Ex: Boleto Banco X")} {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value || null)} disabled={isProcessing} />
                        ) : normalizedFieldName === 'notes' ? (
                            <Textarea placeholder={getLabel('Placeholder Observações', "Detalhes adicionais...")} className="min-h-[100px] resize-y" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value || null)} disabled={isProcessing} />
                        ) : normalizedFieldName === 'file' ? (
                            // *** Seção de Anexo (File Upload Card) - Renderização Condicional ***
                            <Card className="mt-1 border-dashed border-2 hover:border-primary data-[has-file=true]:border-solid data-[has-file=true]:border-primary/50" data-has-file={!!selectedFileName}>
                                <CardContent className="p-3 sm:p-4">
                                    {/* Preview e botão de remover (se arquivo selecionado) */}
                                    <AnimatePresence>{selectedFileName && ( <motion.div key={selectedFileName} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4"> <div className="flex items-center justify-between gap-2 p-2 border rounded-md bg-primary/5"> <div className="flex items-center gap-2 min-w-0"> <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-primary" /> <div className="flex flex-col min-w-0"> <span className="text-xs sm:text-sm font-medium truncate" title={selectedFileName}>{selectedFileName}</span> {selectedFileSize !== null && (<span className="text-xs text-muted-foreground">{(selectedFileSize / 1024 / 1024).toFixed(2)} MB</span>)} </div> </div> <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-6 w-6 sm:h-7 sm:w-7 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeFileInternal(true)} disabled={isProcessing} aria-label="Remover arquivo"><X className="h-3 w-3 sm:h-4 sm:w-4" /></Button></TooltipTrigger><TooltipContent><p>Remover arquivo</p></TooltipContent></Tooltip> </div> </motion.div> )}</AnimatePresence>
                                    {/* Área de upload */}
                                    <label htmlFor="file-upload" className={cn("flex flex-col items-center justify-center p-4 sm:p-6 text-center cursor-pointer transition-colors rounded-md", isProcessing ? "cursor-not-allowed opacity-60 bg-muted/20" : "hover:bg-muted/50", selectedFileName ? 'border-primary/30' : 'border-dashed border-2')}>
                                        <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mb-2" />
                                        <span className="text-xs sm:text-sm text-primary font-medium">{selectedFileName ? 'Selecionar outro' : 'Selecionar anexo'}</span>
                                        <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                                        <span className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, PDF (máx. {MAX_FILE_SIZE_MB}MB)</span>
                                    </label>
                                    {/* O Input real fica escondido */}
                                    <Input id="file-upload" type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(',')} disabled={isProcessing} onChange={handleFileChange} ref={field.ref} name={field.name} onBlur={field.onBlur} />
                                </CardContent>
                            </Card>
                        ) : null}
                    </FormControl>
                    {/* Descrições e Mensagens de Erro */}
                    {normalizedFieldName === 'empreendimento' && preSelectedEmpreendimentoId && (<FormDescription className="text-xs">Pré-selecionado.</FormDescription>)}
                    {normalizedFieldName === 'paymentMethod' && !isRequired && ( <FormDescription className="flex items-center gap-1 text-xs"><Info className="h-3 w-3" />{getLabel('Desc Método Pag.', 'Opcional.')}</FormDescription>)}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
});
RenderFormField.displayName = 'RenderFormField'; // Adiciona displayName para React DevTools

// --- Componente Principal ---
export default function DespesaForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preSelectedEmpreendimentoId = searchParams.get('empreendimento');

    // Estados locais para o arquivo (mantidos)
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
    const [isUploadingViaApiRoute, setIsUploadingViaApiRoute] = useState(false);
    const { toast } = useToast();

    // Hooks de dados (mantidos)
    const { empreendimentos: empreendimentoOptions, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();
    const { createDespesa, isCreating } = useDespesas();
    // Hook de configuração UI
    const { config, isLoading: isLoadingConfig, getLabel, getFieldConfig, getVisibleFields, error: uiConfigError } = useUiConfig('despesas');

    // Estado para o schema dinâmico
    const [dynamicSchema, setDynamicSchema] = useState(() => generateDynamicDespesaSchema(() => undefined)); // Schema inicial

    // Inicialização do Form com schema dinâmico no estado
    const form = useForm<DespesaFormValues>({
        resolver: zodResolver(dynamicSchema), // Usa o schema do estado
        mode: "onChange",
        defaultValues: { /* ... valores padrão ... */
            description: "", value: undefined, date: new Date(), dueDate: new Date(),
            empreendimento: preSelectedEmpreendimentoId ?? "", status: "Pendente", category: undefined,
            paymentMethod: "", notes: "", file: null,
        },
    });

    // Efeito para gerar e aplicar o schema dinâmico quando a config carregar
    useEffect(() => {
        if (config && !isLoadingConfig) {
            console.log("[DespesaForm] Config carregada, gerando schema dinâmico.");
            const newSchema = generateDynamicDespesaSchema(getFieldConfig);
            setDynamicSchema(newSchema); // Atualiza o estado do schema

            // Guarda os valores atuais do formulário
            const currentValues = form.getValues();

            // *** CRÍTICO: Reseta o formulário com o NOVO RESOLVER e mantém os valores ***
            form.reset(currentValues, {
                resolver: zodResolver(newSchema), // Aplica o novo resolver com o novo schema
                keepValues: true, // Mantém os valores que o usuário já digitou
                keepDirty: form.formState.isDirty,
                keepErrors: true, // Pode optar por limpar os erros: keepErrors: false
            });
            console.log("[DespesaForm] Schema dinâmico aplicado ao form.");
        }
    }, [config, isLoadingConfig, getFieldConfig, form]); // Depende da config e do form

    // Pré-selecionar empreendimento (mantido)
    useEffect(() => { /* ... (lógica de pre-seleção inalterada) ... */ if (preSelectedEmpreendimentoId && !isLoadingEmpreendimentos && empreendimentoOptions.some(e => e._id === preSelectedEmpreendimentoId)) { form.setValue('empreendimento', preSelectedEmpreendimentoId); } if (!form.getValues('date')) form.setValue('date', new Date()); if (!form.getValues('dueDate')) form.setValue('dueDate', new Date()); }, [preSelectedEmpreendimentoId, isLoadingEmpreendimentos, empreendimentoOptions, form]);

    // Lógica de Submit (validada pelo schema dinâmico)
    const onSubmit = useCallback(async (values: DespesaFormValues) => {
        // ... (lógica de submit principal inalterada, mas agora usa 'values' validados pelo schema correto) ...
         let despesaCriadaId: string | undefined = undefined;
         setIsUploadingViaApiRoute(false);
         try {
            // Validação dos campos requeridos pela CONFIGURAÇÃO
            const visibleFieldsConfig = getVisibleFields();
             for (const fieldConfig of visibleFieldsConfig) {
                 const fieldName = fieldConfig.fieldName as keyof DespesaFormValues;
                  // Correção para mapear 'attachments' para 'file'
                 const formFieldName = (fieldName as string) === 'attachments' ? ('file' as keyof DespesaFormValues) : fieldName;

                 if (fieldConfig.required && (values[formFieldName] === null || values[formFieldName] === undefined || values[formFieldName] === '')) {
                     toast({ variant: "destructive", title: "Campo Obrigatório", description: `O campo "${getLabel(fieldName)}" é necessário.` });
                     return;
                 }
             }

             // Remover o campo 'file' antes de enviar para createDespesa, pois ele não existe no input tRPC
             const { file, ...inputDataWithoutFile } = values;

             const inputData: CreateDespesaInput = {
                 // Mapeia os valores validados para o tipo esperado por CreateDespesaInput
                 empreendimento: values.empreendimento!,
                 description: values.description!,
                 value: values.value!,
                 // Garante que as datas sejam strings ISO
                 date: (values.date instanceof Date ? values.date : new Date(values.date!)).toISOString(),
                 dueDate: (values.dueDate instanceof Date ? values.dueDate : new Date(values.dueDate!)).toISOString(),
                 status: values.status!,
                 category: values.category!,
                 paymentMethod: values.paymentMethod,
                 notes: values.notes,
             };

             const createdDespesaResult = await createDespesa(inputData);
             despesaCriadaId = createdDespesaResult.despesa?.id;
             if (!createdDespesaResult.success || !despesaCriadaId) throw new Error(createdDespesaResult.message || "Falha ao criar a despesa.");

             if (selectedFile) {
                 setIsUploadingViaApiRoute(true);
                 const formData = new FormData();
                 formData.append('file', selectedFile);
                 formData.append('empreendimentoId', values.empreendimento!);
                 formData.append('despesaId', despesaCriadaId);
                 // Usa a categoria da despesa ou 'Despesas' como fallback
                 formData.append('category', values.category || 'Despesas');
                 const response = await fetch('/api/upload-drive-despesa', { method: 'POST', body: formData });
                 const result = await response.json();
                 if (!response.ok || !result.success) throw new Error(result.error || 'Falha ao enviar anexo para o Google Drive');
                 toast({ title: "Sucesso", description: `Despesa salva e anexo "${selectedFile.name}" enviado!`, variant: "default" });
             } else {
                 toast({ title: "Sucesso", description: "Despesa salva com sucesso!", variant: "default" });
             }

             form.reset();
             removeFileInternal(true);
             router.push('/dashboard/despesas');
             router.refresh();
         } catch (error) { /* ... (tratamento de erro inalterado) ... */ setIsUploadingViaApiRoute(false); console.error("Erro no onSubmit:", error); toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? (despesaCriadaId ? `Despesa salva, mas falha no anexo: ${error.message}. Edite para tentar novamente.` : `Falha ao salvar a despesa: ${error.message}`) : "Ocorreu um problema.", duration: 8000, }); }
    }, [createDespesa, form, router, toast, selectedFile, getVisibleFields, getLabel]); // Adiciona dependências do hook UI

    // Handlers de Arquivo (Inalterados)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (lógica inalterada) ... */ const file = e.target.files?.[0] ?? null; form.setValue('file', file, { shouldValidate: true, shouldDirty: true }); setTimeout(() => { const fieldState = form.getFieldState('file'); if (file && !fieldState.error) { setSelectedFile(file); setSelectedFileName(file.name); setSelectedFileSize(file.size); } else { removeFileInternal(true); if (fieldState.error) { toast({ variant: "destructive", title: "Erro Arquivo", description: fieldState.error.message }); } } }, 50); };
    const removeFileInternal = (clearInput = true) => { /* ... (lógica inalterada) ... */ setSelectedFile(null); setSelectedFileName(null); setSelectedFileSize(null); form.resetField('file', { defaultValue: null }); if (clearInput) { const fi = document.getElementById('file-upload') as HTMLInputElement | null; if (fi) fi.value = ''; } };

    // Estado de Carregamento e Erro
    const isProcessing = isCreating || isLoadingEmpreendimentos || isUploadingViaApiRoute || isLoadingConfig;

    // Renderização condicional de loading/erro (mantida)
    if (isLoadingConfig || (isLoadingEmpreendimentos && !preSelectedEmpreendimentoId)) { return <DespesaFormSkeleton />; }
    if (uiConfigError && (uiConfigError as any)?.data?.code !== 'NOT_FOUND') { return ( <Alert variant="destructive" className="m-4 sm:m-6 lg:m-8 max-w-4xl mx-auto"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Erro Configuração</AlertTitle> <AlertDescription>Não foi possível carregar configurações. Tente recarregar.</AlertDescription> </Alert> ); }

    // Obter campos visíveis do hook
    const visibleFields = getVisibleFields();

    return (
        <TooltipProvider>
            <motion.div /* ... (animação mantida) ... */ initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Header (com labels dinâmicos) */}
                <div className="flex items-center gap-3 sm:gap-4 border-b pb-4">
                    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" disabled={isProcessing} asChild><Link href="/dashboard/despesas"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Voltar</span></Link></Button></TooltipTrigger><TooltipContent><p>{getLabel('Voltar para Lista', 'Voltar')}</p></TooltipContent></Tooltip>
                    <div><h2 className="text-xl sm:text-2xl font-bold tracking-tight">{getLabel('Nova Despesa', 'Nova Despesa')}</h2><p className="text-muted-foreground text-sm sm:text-base">{getLabel('Descrição Nova Despesa', 'Registre um novo gasto ou pagamento.')}</p></div>
                </div>

                <FormProvider {...form}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            {/* Renderização dinâmica dos campos */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                                {visibleFields.map((fieldConfig) => (
                                    <RenderFormField
                                        key={fieldConfig.fieldName} // Usa fieldName como chave
                                        fieldConfig={fieldConfig}
                                        control={form.control}
                                        getLabel={getLabel}
                                        isProcessing={isProcessing}
                                        empreendimentoOptions={empreendimentoOptions}
                                        isLoadingEmpreendimentos={isLoadingEmpreendimentos}
                                        preSelectedEmpreendimentoId={preSelectedEmpreendimentoId}
                                        handleFileChange={handleFileChange}
                                        removeFileInternal={removeFileInternal}
                                        selectedFileName={selectedFileName}
                                        selectedFileSize={selectedFileSize}
                                    />
                                ))}
                            </div>

                            {/* Botões de Ação (com labels dinâmicos) */}
                            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-6 mt-6 border-t">
                                <Button variant="outline" type="button" asChild disabled={isProcessing} className="w-full sm:w-auto order-last sm:order-first"><Link href="/dashboard/despesas"><Ban className="mr-2 h-4 w-4" /> {getLabel('Cancelar', 'Cancelar')}</Link></Button>
                                <Button type="submit" disabled={isProcessing || !form.formState.isValid} className="w-full sm:w-auto">{isProcessing ? (<span className="flex items-center justify-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingViaApiRoute ? getLabel('Enviando Anexo...', 'Enviando Anexo...') : getLabel('Salvando...', 'Salvando...')}</span>) : (<><Save className="mr-2 h-4 w-4" /> {getLabel('Salvar Despesa', 'Salvar Despesa')}</>)}</Button>
                            </div>
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