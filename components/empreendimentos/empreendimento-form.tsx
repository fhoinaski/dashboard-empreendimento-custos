// components/empreendimentos/empreendimento-form.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, X, CalendarIcon, FileText, Loader2, Save, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Importar o TIPO do input esperado pelo tRPC create procedure
import type { CreateEmpreendimentoInput } from "@/server/api/schemas/empreendimentos";

// Schema do FORMULÁRIO - Inclui 'image' como File opcional
const formSchema = z.object({
    name: z.string().min(2, { message: 'O nome deve ter pelo menos 2 caracteres' }),
    address: z.string().min(5, { message: 'O endereço deve ter pelo menos 5 caracteres' }),
    type: z.enum(['Residencial', 'Comercial', 'Misto', 'Industrial'], { required_error: "Tipo é obrigatório" }),
    status: z.enum(['Planejamento', 'Em andamento', 'Concluído'], { required_error: "Status é obrigatório" }),
    totalUnits: z.coerce.number({ invalid_type_error: "Inválido." }).int().min(0, "Deve ser 0 ou maior"),
    soldUnits: z.coerce.number({ invalid_type_error: "Inválido." }).int().min(0, "Deve ser 0 ou maior"),
    startDate: z.date({ required_error: "Data de Início é obrigatória." }),
    endDate: z.date({ required_error: "Data de Conclusão é obrigatória." }),
    description: z.string().optional().nullable(),
    responsiblePerson: z.string().min(3, { message: "Mínimo 3 caracteres." }),
    contactEmail: z.string().email({ message: 'Email inválido' }),
    contactPhone: z.string().min(10, { message: "Mínimo 10 dígitos." }),
    // Validação do arquivo AQUI no form
    image: z.any().optional().nullable()
        .refine(file => !file || (typeof file === 'object' && file !== null && typeof file.size === 'number'), "Deve ser um arquivo válido.")
        .refine(file => !file || file.size <= 10 * 1024 * 1024, `Imagem excede 10MB.`)
        .refine(file => !file || ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file?.type || ''), `Tipo inválido.`),
}).refine(data => data.soldUnits <= data.totalUnits, {
    message: "Vendidas <= Total.", path: ["soldUnits"],
}).refine(data => {
    try { return data.endDate && data.startDate && isValid(data.endDate) && isValid(data.startDate) && data.endDate >= data.startDate; } catch { return false;}
} , {
    message: "Conclusão >= Início.", path: ["endDate"],
});

type EmpreendimentoFormValues = z.infer<typeof formSchema>;

export default function EmpreendimentoForm() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [isUploadingApiRoute, setIsUploadingApiRoute] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const { createEmpreendimento, isCreating } = useEmpreendimentos();

    const form = useForm<EmpreendimentoFormValues>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            name: "", address: "", type: undefined, status: undefined,
            totalUnits: 0, soldUnits: 0, description: "", responsiblePerson: "",
            contactEmail: "", contactPhone: "", startDate: new Date(), endDate: new Date(),
            image: null, // RHF field 'image' starts as null
        },
    });

    // --- onSubmit CORRIGIDO ---
    const onSubmit = useCallback(async (values: EmpreendimentoFormValues) => {
        let uploadedImageUrl: string | undefined = undefined; // Começa undefined
        setIsUploadingApiRoute(false);

        try {
            // 1. FAZER UPLOAD DA IMAGEM PRIMEIRO (se houver) via API Route
            if (selectedFile) { // Usa o estado local 'selectedFile'
                setIsUploadingApiRoute(true);
                console.log('[CreateForm] Iniciando upload da imagem via API Route...');
                const uploadFormData = new FormData();
                uploadFormData.append('file', selectedFile);

                let uploadResult: { url?: string; error?: string; message?: string };
                try {
                    const uploadResponse = await fetch('/api/upload-s3', { method: 'POST', body: uploadFormData });
                    const responseBody = await uploadResponse.json();
                    console.log(`[CreateForm] Upload API Response Status: ${uploadResponse.status}, Body:`, responseBody);
                    if (!uploadResponse.ok) throw new Error(responseBody.error || `Falha no upload (${uploadResponse.status})`);
                    uploadResult = responseBody;
                } catch (fetchError: any) {
                    throw new Error(fetchError.message || "Erro de comunicação no upload.");
                } finally {
                     setIsUploadingApiRoute(false);
                }

                if (!uploadResult.url) {
                    throw new Error(uploadResult.error || 'Falha ao obter URL do upload.');
                }
                uploadedImageUrl = uploadResult.url; // Guarda a URL
                console.log('[CreateForm] Upload OK. URL S3:', uploadedImageUrl);
            } else {
                console.log('[CreateForm] Nenhuma imagem selecionada para upload.');
            }

            // 2. PREPARAR DADOS PARA TRPC ***MANUALMENTE***
            //    Construir objeto SEM espalhar 'values' para evitar incluir image: File | null
            //    Tipar explicitamente como Partial para adicionar 'image' depois
            const inputData: Partial<CreateEmpreendimentoInput> = {
                name: values.name,
                address: values.address,
                type: values.type as CreateEmpreendimentoInput['type'], // Cast seguro
                status: values.status as CreateEmpreendimentoInput['status'], // Cast seguro
                totalUnits: values.totalUnits,
                soldUnits: values.soldUnits,
                startDate: values.startDate.toISOString(), // Envia como ISO string
                endDate: values.endDate.toISOString(), // Envia como ISO string
                description: values.description,
                responsiblePerson: values.responsiblePerson,
                contactEmail: values.contactEmail,
                contactPhone: values.contactPhone,
                // NÃO incluir 'image' aqui inicialmente
            };

            // Adiciona a URL da imagem SOMENTE se ela foi definida no upload
            if (uploadedImageUrl !== undefined) {
                inputData.image = uploadedImageUrl; // Adiciona a propriedade image ao objeto
            }
            // Se não houve upload, inputData.image permanece undefined e não é enviado

            console.log('[CreateForm] Dados FINAIS para tRPC create:', JSON.stringify(inputData)); // Verificar o objeto final

            // 3. CHAMAR MUTATION TRPC createEmpreendimento
            //    Cast para o tipo completo é seguro aqui pois o schema base valida os campos obrigatórios
            await createEmpreendimento(inputData as CreateEmpreendimentoInput);

            // Hook já mostra toast de sucesso e invalida queries
            form.reset();
            removeFileInternal(true); // Limpa UI state E input
            router.push("/dashboard/empreendimentos");
            router.refresh();

        } catch (error: any) {
            setIsUploadingApiRoute(false); // Garante fim do loading em erro
            console.error("Erro ao cadastrar empreendimento (onSubmit Catch Block):", error);
            toast({ variant: "destructive", title: "Erro ao Salvar", description: error.message || "Ocorreu um erro inesperado." });
        }
    }, [createEmpreendimento, form, router, toast, selectedFile]); // Adiciona selectedFile


    // --- File Handling (UI e Estado Local) ---
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        // Atualiza RHF para validação
        form.setValue('image', file, { shouldValidate: true, shouldDirty: true });
        // Atualiza estado local para UI e para o onSubmit usar
        setSelectedFile(file);

        // Garante que a validação rodou antes de atualizar o preview
        setTimeout(() => {
            const fieldState = form.getFieldState('image');
            if (file && !fieldState.error) {
                setSelectedFileName(file.name);
                setSelectedFileSize(file.size);
                const reader = new FileReader();
                reader.onloadend = () => setImagePreviewUrl(reader.result as string);
                reader.readAsDataURL(file);
            } else {
                removeFileInternal(false); // Limpa UI se inválido ou sem arquivo
                // Mensagem de erro já deve estar visível via FormMessage
            }
        }, 0);
    };

    // Limpa UI state e opcionalmente o input
     const removeFileInternal = (clearInput = true) => {
        setSelectedFile(null);
        setSelectedFileName(null);
        setSelectedFileSize(null);
        setImagePreviewUrl(null);
        // Usa resetField para limpar o valor e estado do RHF corretamente
        form.resetField('image', { defaultValue: null });
        if (clearInput) {
            const fileInput = document.getElementById('image-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        }
    };

    // Estado de processamento combinado
    const isProcessing = isCreating || isUploadingApiRoute;

    return (
        <TooltipProvider>
            <motion.div // Add motion div here
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
                className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8"
            >
                {/* Header */}
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center border-b pb-4">
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="icon" asChild className="h-8 w-8 flex-shrink-0" disabled={isProcessing}>
                            <Link href="/dashboard/empreendimentos"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Voltar</span></Link>
                        </Button>
                    </TooltipTrigger><TooltipContent><p>Voltar para Lista</p></TooltipContent></Tooltip>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Novo Empreendimento</h2>
                        <p className="text-sm text-muted-foreground sm:text-base">Preencha os dados para criar.</p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ex: Residencial Aurora" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Endereço <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="Ex: Av. Paulista, 1000, São Paulo - SP" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={form.control} name="type" render={({ field }) => ( <FormItem><FormLabel>Tipo <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isProcessing}><FormControl><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Residencial">Residencial</SelectItem><SelectItem value="Comercial">Comercial</SelectItem><SelectItem value="Misto">Misto</SelectItem><SelectItem value="Industrial">Industrial</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isProcessing}><FormControl><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger></FormControl><SelectContent><SelectItem value="Planejamento">Planejamento</SelectItem><SelectItem value="Em andamento">Em andamento</SelectItem><SelectItem value="Concluído">Concluído</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={form.control} name="totalUnits" render={({ field }) => ( <FormItem><FormLabel>Total Unidades <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="soldUnits" render={({ field }) => ( <FormItem><FormLabel>Vendidas <span className="text-destructive">*</span></FormLabel><FormControl><Input type="number" min="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={form.control} name="startDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Início <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left", !field.value && "text-muted-foreground")} disabled={isProcessing}>{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isProcessing}/></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="endDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Conclusão <span className="text-destructive">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left", !field.value && "text-muted-foreground")} disabled={isProcessing}>{field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={isProcessing}/></PopoverContent></Popover><FormMessage /></FormItem> )} />
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} value={field.value ?? ''} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="responsiblePerson" render={({ field }) => ( <FormItem><FormLabel>Responsável <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={form.control} name="contactEmail" render={({ field }) => ( <FormItem><FormLabel>Email Contato <span className="text-destructive">*</span></FormLabel><FormControl><Input type="email" {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="contactPhone" render={({ field }) => ( <FormItem><FormLabel>Telefone Contato <span className="text-destructive">*</span></FormLabel><FormControl><Input {...field} disabled={isProcessing} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                {/* Image Upload Field */}
                                <FormField control={form.control} name="image" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="image-upload">Foto de Capa (Opcional)</FormLabel>
                                        <Card className="mt-2 border-dashed border-2 hover:border-primary data-[has-image=true]:border-solid data-[has-image=true]:border-primary/50" data-has-image={!!imagePreviewUrl}>
                                            <CardContent className="p-4">
                                                {imagePreviewUrl && (
                                                    <div className="mb-4 relative group">
                                                        <img src={imagePreviewUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-md border bg-muted"/>
                                                        <Tooltip><TooltipTrigger asChild>
                                                            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-80 group-hover:opacity-100" onClick={() => removeFileInternal(true)} disabled={isProcessing}><X className="h-4 w-4" /></Button>
                                                        </TooltipTrigger><TooltipContent><p>Remover Imagem</p></TooltipContent></Tooltip>
                                                    </div>
                                                )}
                                                <label htmlFor="image-upload" className={cn("flex flex-col items-center justify-center p-6 text-center cursor-pointer rounded-md", isProcessing && "cursor-not-allowed opacity-60", !imagePreviewUrl && "hover:bg-muted/50")}>
                                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                                    <span className="text-sm text-primary font-medium">{imagePreviewUrl ? 'Selecionar outra' : 'Selecionar imagem'}</span>
                                                    <span className="text-xs text-muted-foreground mt-1">ou arraste e solte</span>
                                                    <span className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, WEBP (máx. 10MB)</span>
                                                    <FormControl>
                                                        <Input id="image-upload" type="file" className="hidden" accept="image/*"
                                                            onChange={(e) => handleFileChange(e)} // Usa estado local
                                                            disabled={isProcessing}/>
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
                        <div className="flex flex-col gap-4 sm:flex-row sm:justify-end">
                            <Button variant="outline" type="button" asChild disabled={isProcessing} className="w-full sm:w-auto">
                                <Link href="/dashboard/empreendimentos"><Ban className="mr-2 h-4 w-4"/> Cancelar</Link>
                            </Button>
                            <Button type="submit" disabled={isProcessing} className="w-full sm:w-auto">
                                {isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isUploadingApiRoute ? 'Enviando Imagem...' : 'Salvando Dados...'}</>) : (<><Save className="mr-2 h-4 w-4"/> Salvar Empreendimento</>)}
                            </Button>
                        </div>
                    </form>
                </Form>
            </motion.div>
        </TooltipProvider>
    );
}