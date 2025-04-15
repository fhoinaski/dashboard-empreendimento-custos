// ============================================================
// ARQUIVO REFATORADO: components/empreendimentos/empreendimento-form.tsx
// (Integração com useUiConfig para validação e renderização dinâmica)
// ============================================================
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Save, Ban, Building, HardHat, AlertCircle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { useUiConfig } from '@/hooks/useUiConfig'; // *** IMPORTAR HOOK UI CONFIG ***
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CreateEmpreendimentoInput } from "@/server/api/schemas/empreendimentos";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Import Alert

// --- Constantes e Tipos ---
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

// Tipo para os valores do formulário (derivado do schema dinâmico)
type EmpreendimentoFormValues = z.infer<ReturnType<typeof generateDynamicSchema>>;

// --- Função para Gerar Schema Dinâmico ---
const generateDynamicSchema = (getFieldConfig: (fieldName: string) => any | undefined) => {
    const getValidationRule = (fieldName: string, defaultRule: z.ZodTypeAny, isRequired: boolean) => {
        const configRequired = getFieldConfig(fieldName)?.required ?? isRequired; // Usa config, fallback para default
        let rule = defaultRule;

        // Aplica validação mínima apenas se for requerido pela config
        if (configRequired) {
            if (rule instanceof z.ZodString) rule = rule.min(1, { message: "Campo obrigatório" });
            if (rule instanceof z.ZodNumber) rule = rule.min(0); // Ou min(1) se necessário
            if (rule instanceof z.ZodDate) rule = rule.refine(val => val !== null && val !== undefined, { message: "Campo obrigatório" });
            if (rule instanceof z.ZodEnum) rule = rule.refine(val => val !== null && val !== undefined, { message: "Seleção obrigatória" });
        } else {
            // Torna opcional se não for requerido pela config
            rule = rule.optional().nullable(); // Permite null e undefined
        }
        return rule;
    };

    // Define a estrutura base, aplicando regras dinamicamente
    const dynamicShape = {
        name: getValidationRule('name', z.string().trim().min(2, { message: "Nome: Mínimo 2 caracteres." }), true),
        address: getValidationRule('address', z.string().trim().min(5, { message: "Endereço: Mínimo 5 caracteres." }), true),
        type: getValidationRule('type', z.enum(["Residencial", "Comercial", "Misto", "Industrial"], { required_error: "Tipo é obrigatório" }), true),
        status: getValidationRule('status', z.enum(["Planejamento", "Em andamento", "Concluído"], { required_error: "Status é obrigatório" }), true),
        totalUnits: getValidationRule('totalUnits', z.coerce.number({ invalid_type_error: "Inválido." }).int().min(0, "Deve ser 0 ou maior"), true),
        soldUnits: getValidationRule('soldUnits', z.coerce.number({ invalid_type_error: "Inválido." }).int().min(0, "Deve ser 0 ou maior"), true),
        startDate: getValidationRule('startDate', z.date({ required_error: "Obrigatório." }), true),
        endDate: getValidationRule('endDate', z.date({ required_error: "Obrigatório." }), true),
        description: getValidationRule('description', z.string(), false), // description é opcional por padrão
        responsiblePerson: getValidationRule('responsiblePerson', z.string().trim().min(3, { message: "Mínimo 3 caracteres." }), true),
        // *** EMAIL E TELEFONE COM REGRAS DINÂMICAS ***
        contactEmail: getValidationRule('contactEmail', z.string().email({ message: 'Email inválido' }), false), // Default não obrigatório
        contactPhone: getValidationRule('contactPhone', z.string().min(10, { message: 'Mínimo 10 dígitos.' }), false), // Default não obrigatório
        // ---------------------------------------------
        image: z.any()
            .optional().nullable()
            .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), { message: "Selecione um arquivo válido." })
            .refine(file => !file || file.size <= MAX_IMAGE_SIZE_BYTES, `Imagem excede ${MAX_IMAGE_SIZE_MB}MB.`)
            .refine(file => !file || ACCEPTED_IMAGE_TYPES.includes(file?.type || ''), `Tipo inválido: ${ACCEPTED_IMAGE_TYPES.join(', ')}`),
    };

    return z.object(dynamicShape).refine(data => {
        // A validação só ocorre se ambos os campos estiverem definidos e não nulos
        if (data.soldUnits !== null && data.soldUnits !== undefined && data.totalUnits !== null && data.totalUnits !== undefined) {
            return data.soldUnits <= data.totalUnits;
        }
        return true;
    }, {
        message: "Vendidas <= Total.",
        path: ["soldUnits"],
    }).refine(data => {
        // A validação só ocorre se ambas as datas estiverem definidas, não nulas e válidas
        if (data.startDate && data.endDate && isValid(data.startDate) && isValid(data.endDate)) {
            return data.endDate >= data.startDate;
        }
        return true;
    }, {
        message: "Conclusão >= Início.",
        path: ["endDate"],
    });
};

// --- Componente Principal ---
export default function EmpreendimentoForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingApiRoute, setIsUploadingApiRoute] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Hook tRPC para criação
  const { createEmpreendimento, isCreating } = useEmpreendimentos();
  // Hook para Configuração de UI
  const { config, isLoading: isLoadingConfig, getLabel, getFieldConfig, getVisibleFields, error: uiConfigError } = useUiConfig('empreendimentos');

  // Estado do Schema Zod
  const [dynamicSchema, setDynamicSchema] = useState(() => generateDynamicSchema(() => undefined)); // Schema inicial básico

  // Inicialização do Formulário
  const form = useForm<EmpreendimentoFormValues>({
    resolver: zodResolver(dynamicSchema), // Inicia com schema básico
    mode: "onChange",
    defaultValues: { /* ... valores padrão ... */
      name: "", address: "", type: undefined, status: undefined,
      totalUnits: 0, soldUnits: 0, description: "", responsiblePerson: "",
      contactEmail: "", contactPhone: "", startDate: new Date(), endDate: new Date(),
      image: null,
    },
  });

  // Efeito para atualizar o schema quando a config carregar
  useEffect(() => {
    if (config && !isLoadingConfig) {
      console.log("[EmpreendimentoForm] Config carregada, gerando schema dinâmico.");
      const newSchema = generateDynamicSchema(getFieldConfig);
      setDynamicSchema(newSchema);
      // Re-inicializa o resolver do form com o novo schema
      form.reset(form.getValues(), {
          // @ts-ignore // Pode precisar ignorar se tipos não baterem perfeitamente
          resolver: zodResolver(newSchema),
          keepValues: true, // Mantém os valores atuais se possível
          keepDirty: form.formState.isDirty,
          keepErrors: true,
      });
      console.log("[EmpreendimentoForm] Schema dinâmico aplicado.");
    }
  }, [config, isLoadingConfig, getFieldConfig, form]);

  // Lógica de Submit (praticamente inalterada, usa `values` validados pelo schema dinâmico)
  const onSubmit = useCallback(
    async (values: EmpreendimentoFormValues) => {
      let uploadedImageUrl: string | undefined = undefined;
      setIsUploadingApiRoute(false);

      try {
        // Upload de imagem (mantido)
        if (selectedFile) {
          setIsUploadingApiRoute(true);
          // ... (lógica de upload S3) ...
          const uploadFormData = new FormData(); uploadFormData.append("file", selectedFile);
          const uploadResponse = await fetch("/api/upload-s3", { method: "POST", body: uploadFormData });
          const responseBody = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(responseBody.error || `Upload failed (${uploadResponse.status})`);
          if (!responseBody.url) throw new Error(responseBody.error || "Failed to get upload URL.");
          uploadedImageUrl = responseBody.url;
          setIsUploadingApiRoute(false);
        }

        // Preparar dados para tRPC
        const inputData: Partial<CreateEmpreendimentoInput> = {
          name: values.name!, // ! porque são requeridos pelo schema base
          address: values.address!,
          type: values.type as CreateEmpreendimentoInput["type"], // Cast necessário
          status: values.status as CreateEmpreendimentoInput["status"], // Cast necessário
          totalUnits: values.totalUnits!,
          soldUnits: values.soldUnits!,
          startDate: values.startDate!.toISOString(),
          endDate: values.endDate!.toISOString(),
          description: values.description,
          responsiblePerson: values.responsiblePerson!,
          contactEmail: values.contactEmail!, // Incluído, pode ser null/"" se não obrigatório
          contactPhone: values.contactPhone!, // Incluído, pode ser null/"" se não obrigatório
        };
        if (uploadedImageUrl !== undefined) inputData.image = uploadedImageUrl;

        // Chamada tRPC (mantida)
        await createEmpreendimento(inputData as CreateEmpreendimentoInput);

        form.reset(); removeFileInternal(true); router.push("/dashboard/empreendimentos"); router.refresh();

      } catch (error: any) {
        setIsUploadingApiRoute(false);
        console.error("Erro onSubmit EmpreendimentoForm:", error);
        toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message || "Ocorreu um erro inesperado." });
      }
    },
    [createEmpreendimento, form, router, toast, selectedFile]
  );

  // Handlers de Arquivo (Inalterados)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ const file = e.target.files?.[0] ?? null; form.setValue("image", file, { shouldValidate: true, shouldDirty: true }); setSelectedFile(file); setTimeout(() => { const fieldState = form.getFieldState("image"); if (file && !fieldState.error) { setSelectedFileName(file.name); setSelectedFileSize(file.size); const reader = new FileReader(); reader.onloadend = () => setImagePreviewUrl(reader.result as string); reader.readAsDataURL(file); } else { removeFileInternal(false); } }, 0); };
  const removeFileInternal = (clearInput = true) => { /* ... */ setSelectedFile(null); setSelectedFileName(null); setSelectedFileSize(null); setImagePreviewUrl(null); form.resetField("image", { defaultValue: null }); if (clearInput) { const fi = document.getElementById("image-upload") as HTMLInputElement; if (fi) fi.value = ""; } };

  // --- Estado de Carregamento e Erro ---
  const isProcessing = isCreating || isUploadingApiRoute || isLoadingConfig;

  if (isLoadingConfig) {
      return ( /* ... Skeleton ... */
          <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8 animate-pulse"> <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center border-b pb-4"><Skeleton className="h-8 w-8 rounded-md flex-shrink-0" /><div><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64 mt-1" /></div></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2"><div className="space-y-6">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div><div className="space-y-6">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}<Skeleton className="h-40 w-full"/></div></div><div className="flex flex-col gap-4 sm:flex-row sm:justify-end"><Skeleton className="h-10 w-full sm:w-24"/><Skeleton className="h-10 w-full sm:w-36"/></div> </div>
       );
  }
   if (uiConfigError && (uiConfigError as any)?.data?.code !== 'NOT_FOUND') {
       return ( /* ... Error Alert ... */
           <Alert variant="destructive" className="m-4 sm:m-6 lg:m-8 max-w-6xl mx-auto"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Erro ao Carregar Configuração</AlertTitle> <AlertDescription>Não foi possível carregar as configurações de UI. Tente recarregar.</AlertDescription> </Alert>
       );
   }

  // Função auxiliar para verificar visibilidade
  const isVisible = (fieldName: string) => getFieldConfig(fieldName)?.visible ?? true; // Default true if not configured

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
        className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      >
        {/* Header (com label dinâmico) */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center border-b pb-4">
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0" disabled={isProcessing}><Link href="/dashboard/empreendimentos"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Voltar</span></Link></Button></TooltipTrigger><TooltipContent><p>{getLabel('Voltar para Lista', 'Voltar')}</p></TooltipContent></Tooltip>
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{getLabel('Novo Empreendimento', 'Novo Empreendimento')}</h2>
            <p className="text-sm text-muted-foreground sm:text-base">{getLabel('Descrição Novo Emp.', 'Preencha os dados para criar.')}</p>
          </div>
        </div>

        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Coluna Esquerda */}
                <div className="space-y-6">
                  {isVisible('name') && (
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        {/* Label Dinâmico com indicador de obrigatório */}
                        <FormLabel>{getLabel('Nome')} {getFieldConfig('name')?.required && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl><Input placeholder={getLabel('Placeholder Nome Emp.', "Ex: Residencial Aurora")} {...field} disabled={isProcessing} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}/>
                  )}
                  {isVisible('address') && (
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                         <FormLabel>{getLabel('Endereço')} {getFieldConfig('address')?.required && <span className="text-destructive">*</span>}</FormLabel>
                         <FormControl><Input placeholder={getLabel('Placeholder Endereço', "Ex: Av. Paulista, 1000, São Paulo - SP")} {...field} disabled={isProcessing} /></FormControl>
                         <FormMessage />
                      </FormItem>
                     )}/>
                  )}
                   {/* Tipo e Status */}
                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     {isVisible('type') && (
                       <FormField control={form.control} name="type" render={({ field }) => (
                         <FormItem>
                           <FormLabel>{getLabel('Tipo')} {getFieldConfig('type')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing}><FormControl><SelectTrigger><div className="flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder={getLabel('Placeholder Tipo', "Selecione")} /></div></SelectTrigger></FormControl><SelectContent><SelectItem value="Residencial">Residencial</SelectItem><SelectItem value="Comercial">Comercial</SelectItem><SelectItem value="Misto">Misto</SelectItem><SelectItem value="Industrial">Industrial</SelectItem></SelectContent></Select>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                     {isVisible('status') && (
                       <FormField control={form.control} name="status" render={({ field }) => (
                         <FormItem>
                           <FormLabel>{getLabel('Status')} {getFieldConfig('status')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <Select onValueChange={field.onChange} value={field.value} disabled={isProcessing}><FormControl><SelectTrigger><div className="flex items-center gap-2"><HardHat className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder={getLabel('Placeholder Status', "Selecione")} /></div></SelectTrigger></FormControl><SelectContent><SelectItem value="Planejamento">Planejamento</SelectItem><SelectItem value="Em andamento">Em andamento</SelectItem><SelectItem value="Concluído">Concluído</SelectItem></SelectContent></Select>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                   </div>
                   {/* Unidades */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     {isVisible('totalUnits') && (
                       <FormField control={form.control} name="totalUnits" render={({ field }) => (
                         <FormItem>
                           <FormLabel>{getLabel('Total Unid.')} {getFieldConfig('totalUnits')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} disabled={isProcessing} /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                     {isVisible('soldUnits') && (
                       <FormField control={form.control} name="soldUnits" render={({ field }) => (
                         <FormItem>
                           <FormLabel>{getLabel('Vendidas')} {getFieldConfig('soldUnits')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} disabled={isProcessing} /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                   </div>
                   {/* Datas */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     {isVisible('startDate') && (
                       <FormField control={form.control} name="startDate" render={({ field }) => (
                         <FormItem className="flex flex-col">
                           <FormLabel>{getLabel('Início')} {getFieldConfig('startDate')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !field.value && "text-muted-foreground")} disabled={isProcessing}>{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isProcessing} /></PopoverContent></Popover>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                     {isVisible('endDate') && (
                       <FormField control={form.control} name="endDate" render={({ field }) => (
                         <FormItem className="flex flex-col">
                           <FormLabel>{getLabel('Conclusão')} {getFieldConfig('endDate')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !field.value && "text-muted-foreground")} disabled={isProcessing}>{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isProcessing} /></PopoverContent></Popover>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                   </div>
                </div>

                {/* Coluna Direita */}
                <div className="space-y-6">
                   {isVisible('description') && (
                     <FormField control={form.control} name="description" render={({ field }) => (
                       <FormItem>
                         <FormLabel>{getLabel('Descrição')} {getFieldConfig('description')?.required && <span className="text-destructive">*</span>}</FormLabel>
                         <FormControl><Textarea placeholder={getLabel('Placeholder Descrição Emp.', "Detalhes sobre o projeto...")} className="min-h-[120px]" {...field} value={field.value ?? ""} disabled={isProcessing} /></FormControl>
                         <FormMessage />
                       </FormItem>
                     )}/>
                   )}
                   {isVisible('responsiblePerson') && (
                     <FormField control={form.control} name="responsiblePerson" render={({ field }) => (
                       <FormItem>
                         <FormLabel>{getLabel('Responsável')} {getFieldConfig('responsiblePerson')?.required && <span className="text-destructive">*</span>}</FormLabel>
                         <FormControl><Input placeholder={getLabel('Placeholder Responsável', "Nome do gestor")} {...field} disabled={isProcessing} /></FormControl>
                         <FormMessage />
                       </FormItem>
                     )}/>
                   )}
                    {/* Contatos */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                     {isVisible('contactEmail') && (
                       <FormField control={form.control} name="contactEmail" render={({ field }) => (
                         <FormItem>
                           {/* Usa config para required (*) */}
                           <FormLabel>{getLabel('Email Contato')} {getFieldConfig('contactEmail')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <FormControl><Input type="email" placeholder={getLabel('Placeholder Email Contato', "contato@construtora.com")} {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value || null)} disabled={isProcessing} /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                     {isVisible('contactPhone') && (
                       <FormField control={form.control} name="contactPhone" render={({ field }) => (
                         <FormItem>
                           {/* Usa config para required (*) */}
                           <FormLabel>{getLabel('Telefone Contato')} {getFieldConfig('contactPhone')?.required && <span className="text-destructive">*</span>}</FormLabel>
                           <FormControl><Input placeholder={getLabel('Placeholder Tel Contato', "(XX) 9XXXX-XXXX")} {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value || null)} disabled={isProcessing} /></FormControl>
                           <FormMessage />
                         </FormItem>
                       )}/>
                     )}
                   </div>
                   {/* Imagem */}
                   {isVisible('image') && (
                     <FormField control={form.control} name="image" render={({ field }) => (
                       <FormItem>
                         <FormLabel htmlFor="image-upload">{getLabel('Foto Capa')} {getFieldConfig('image')?.required && <span className="text-destructive">*</span>}</FormLabel>
                         <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-image=true]:border-solid data-[has-image=true]:border-primary/50" data-has-image={!!imagePreviewUrl}>
                           <CardContent className="p-4">
                             <AnimatePresence>{imagePreviewUrl && ( <motion.div key="img-preview" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="mb-4 relative group"> <img src={imagePreviewUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-md border bg-muted" /> <Tooltip><TooltipTrigger asChild><Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-80 group-hover:opacity-100" onClick={() => removeFileInternal(true)} disabled={isProcessing}><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Remover Imagem</p></TooltipContent></Tooltip> </motion.div> )}</AnimatePresence>
                             <label htmlFor="image-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer rounded-md", isProcessing && "cursor-not-allowed opacity-60", !imagePreviewUrl && "hover:bg-muted/50")}> <Upload className="h-8 w-8 text-muted-foreground mb-2" /> <span className="text-sm text-primary font-medium">{imagePreviewUrl ? 'Selecionar outra' : 'Selecionar imagem'}</span> <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span> <span className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, WEBP (máx. {MAX_IMAGE_SIZE_MB}MB)</span> <FormControl><Input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isProcessing} /></FormControl> </label>
                             <FormMessage className="mt-2" />
                           </CardContent>
                         </Card>
                       </FormItem>
                     )}/>
                   )}
                </div>
              </div>

              {/* Botões de Ação (com labels dinâmicos) */}
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
                 <Button variant="outline" type="button" asChild disabled={isProcessing} className="w-full sm:w-auto"><Link href="/dashboard/empreendimentos"><Ban className="mr-2 h-4 w-4" /> {getLabel('Cancelar', 'Cancelar')}</Link></Button>
                 <Button type="submit" disabled={isProcessing || !form.formState.isValid} className="w-full sm:w-auto">{isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingApiRoute ? getLabel('Enviando Imagem...', 'Enviando Imagem...') : getLabel('Salvando...', 'Salvando...')}</>) : (<><Save className="mr-2 h-4 w-4" /> {getLabel('Salvar Empreendimento', 'Salvar Empreendimento')}</>)}</Button>
              </div>
            </form>
          </Form>
        </FormProvider>
      </motion.div>
    </TooltipProvider>
  );
}
// ============================================================
// FIM DO ARQUIVO REFATORADO
// ============================================================