// components/configuracoes/company-settings-form.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Save, Loader2, Building } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { handleFileSelect, removeFile } from './settings-helpers';
// *** Importar o hook useSettings ***
import { useSettings } from '@/hooks/useSettings';
// *** Importar tipo de Input para a mutation ***
import type { UpdateCompanySettingsInput } from '@/server/api/schemas/settings';
// Importar TRPCError
import { TRPCError } from '@trpc/server';

// Schema Zod (sem alterações)
const companySchema = z.object({
    companyName: z.string().trim().optional().nullable(), // Adiciona trim()
    cnpj: z.string().trim()
        .refine((val) => !val || /^\d{14}$/.test(val.replace(/\D/g,'')), { message: "CNPJ inválido (14 dígitos)"})
        .optional().nullable(),
    companyAddress: z.string().trim().optional().nullable(),
    companyPhone: z.string().trim().optional().nullable(),
    companyEmail: z.string().email("Email inválido").optional().nullable(),
    logo: z.any() // Mantém z.any() para File
        .optional().nullable()
        .refine(file => !file || file.size <= 2 * 1024 * 1024, `Logo excede 2MB.`)
        .refine(file => !file || ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'].includes(file.type), `Tipo de logo inválido.`),
});

type CompanyFormData = z.infer<typeof companySchema>;
// Não precisamos mais de CompanySettingsData, usaremos o tipo retornado pela query

export default function CompanySettingsForm() {
    const { toast } = useToast();
    // Remover useState para isLoading e isSubmitting, usar os do hook
    // const [isLoading, setIsLoading] = useState(true); // REMOVED
    // const [isSubmitting, setIsSubmitting] = useState(false); // REMOVED
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null); // Manter para UI preview
    const [selectedLogoName, setSelectedLogoName] = useState<string | null>(null); // Manter para UI
    const [wasImageRemoved, setWasImageRemoved] = useState(false); // State para indicar remoção de imagem
    const [isUploadingApiRoute, setIsUploadingApiRoute] = useState(false); // State para upload via API route

    // *** Usar o hook useSettings ***
    const {
        companySettingsQuery, // Query para buscar dados
        updateCompany, // Mutation para atualizar
        isCompanyLoading, // Estado de loading da query
        updateCompanyMutation // Acessa isPending da mutation
    } = useSettings();

    // Usar isPending da mutation para o estado de submitting
    const isSubmitting = updateCompanyMutation.isPending || isUploadingApiRoute;
    // Usar isLoading da query para o estado de loading inicial
    const isLoading = isCompanyLoading;

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            companyName: '', cnpj: '', companyAddress: '', companyPhone: '',
            companyEmail: '', logo: null
        },
    });

    // --- Fetch initial data using tRPC Query ---
    useEffect(() => {
        // O hook react-query/tRPC gerencia o fetch e re-fetch
        if (companySettingsQuery.data) {
            const data = companySettingsQuery.data;
            console.log("[CompanyForm] Data from tRPC query:", data);
            const defaults = {
                companyName: data.companyName ?? '',
                cnpj: data.cnpj ?? '',
                companyAddress: data.companyAddress ?? '',
                companyPhone: data.companyPhone ?? '',
                companyEmail: data.companyEmail ?? '',
                logo: null // Reset logo field
            };
            form.reset(defaults);
            setCurrentLogoUrl(data.logoUrl ?? null); // Atualiza preview com URL da query
            setSelectedLogoName(null); // Limpa nome de arquivo selecionado
            setWasImageRemoved(false); // Reseta flag de remoção
        } else if (companySettingsQuery.error) {
             // O erro já é logado no hook, pode adicionar toast específico se quiser
             // toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar." });
        }
        // Não precisa mais gerenciar isLoading manualmente aqui
    }, [companySettingsQuery.data, companySettingsQuery.error, form, toast]); // Depende dos dados/erro da query

    // --- handleCompanySubmit using tRPC Mutation ---
    const handleCompanySubmit = useCallback(async (values: CompanyFormData) => {
        let finalImageUrl: string | null | undefined = undefined; // undefined = no change, null = remove
        setIsUploadingApiRoute(false); // Reset loading state for API route upload
        const originalData = companySettingsQuery.data; // Pega os dados atuais da query

         // Se não houver dados originais carregados, não prosseguir
         if (!originalData) {
             toast({ variant: "destructive", title: "Erro", description: "Dados da empresa não carregados. Tente novamente." });
             console.error("[CompanyForm onSubmit] Original data not available!");
             return;
         }

        try {
             // 1. Lógica de Upload da Imagem (se houver) via API Route (mantida por enquanto)
             const isFileObject = values.logo && typeof values.logo === 'object' && typeof (values.logo as File).size === 'number';
             if (isFileObject) {
                setIsUploadingApiRoute(true);
                console.log('[CompanyForm] Uploading logo via API Route...');
                const uploadFormData = new FormData();
                uploadFormData.append('file', values.logo as File);
                try {
                    const uploadResponse = await fetch('/api/upload-s3', { method: 'POST', body: uploadFormData });
                    const responseBody = await uploadResponse.json();
                    if (!uploadResponse.ok) throw new Error(responseBody.error || `Upload failed (${uploadResponse.status})`);
                    if (!responseBody.url) throw new Error(responseBody.error || 'Failed to get upload URL.');
                    finalImageUrl = responseBody.url; // Define a URL para a mutation tRPC
                    console.log('[CompanyForm] Upload OK. S3 URL:', finalImageUrl);
                    setWasImageRemoved(false); // Reset flag if new image uploaded
                } catch (fetchError: any) { throw new Error(fetchError.message || "Upload communication error."); }
                finally { setIsUploadingApiRoute(false); }
             } else if (wasImageRemoved) {
                 finalImageUrl = null; // Marcar para remoção no backend
                 console.log('[CompanyForm] Image marked for removal.');
             } else {
                 finalImageUrl = undefined; // Nenhuma mudança na imagem
                 console.log('[CompanyForm] No image changes.');
             }


             // 2. Preparar dados para a mutation tRPC (apenas campos alterados)
             // Tipar explicitamente o payload
             const dataToUpdate: Partial<UpdateCompanySettingsInput> = {};
             let hasChanges = false;

             // Compara cada campo do formulário com os dados originais da query
             (Object.keys(companySchema.shape) as Array<keyof CompanyFormData>).forEach(key => {
                 if (key === 'logo') return; // Logo é tratado pelo finalImageUrl

                 const formValue = values[key];
                 const originalValue = originalData[key as keyof typeof originalData];

                 // Compara de forma segura, tratando null/undefined/strings vazias
                 const currentValString = String(formValue ?? '').trim();
                 const originalValString = String(originalValue ?? '').trim();

                 if (currentValString !== originalValString) {
                     // Adiciona ao payload apenas se mudou
                     // Converte string vazia para null se o schema permite
                     const zodField = companySchema.shape[key];
                     const canBeNull = zodField instanceof z.ZodOptional || zodField instanceof z.ZodNullable;
                     (dataToUpdate as any)[key] = (currentValString === '' && canBeNull) ? null : formValue;
                     hasChanges = true;
                 }
             });

             // Adiciona a imagem ao payload se houve mudança nela
             if (finalImageUrl !== undefined) {
                 dataToUpdate.logoUrl = finalImageUrl; // Nome do campo esperado pelo schema de update
                 hasChanges = true;
             }

             console.log('[CompanyForm] Data to update via tRPC:', dataToUpdate);

             // 3. Chamar a mutation tRPC APENAS se houver alterações
             if (!hasChanges) {
                 toast({ title: "Nenhuma alteração", description: "Nenhum dado foi modificado." });
                 form.reset({...values, logo: null}, { keepDirty: false }); // Reseta dirty state
                 setCurrentLogoUrl(originalData.logoUrl ?? null); // Restaura preview original
                 setSelectedLogoName(null);
                 setWasImageRemoved(false);
                 return; // Sai se não há mudanças
             }

             // Chama a mutation do hook useSettings
             const result = await updateCompany(dataToUpdate);

             // Hook já lida com toast de sucesso/erro e invalidação
             // Apenas reseta o formulário com os dados retornados (se houver)
             if (result.success && result.settings) {
                 const returnedData = result.settings;
                 form.reset({
                     companyName: returnedData.companyName ?? '',
                     cnpj: returnedData.cnpj ?? '',
                     companyAddress: returnedData.companyAddress ?? '',
                     companyPhone: returnedData.companyPhone ?? '',
                     companyEmail: returnedData.companyEmail ?? '',
                     logo: null // Sempre reseta o campo de arquivo
                 }, { keepDirty: false });
                 setCurrentLogoUrl(returnedData.logoUrl ?? null);
                 setSelectedLogoName(null);
                 setWasImageRemoved(false);
             } else {
                 // Se a mutation falhou (hook deve ter mostrado toast),
                 // talvez resetar para os valores originais ou manter os valores atuais?
                 // Vamos manter os valores atuais no form para o usuário tentar corrigir
                 form.reset({...values, logo: null}); // Reseta apenas o campo de arquivo
                 setSelectedLogoName(values.logo ? (values.logo as File).name : null); // Mantém nome se erro foi depois do upload
                 // Não reseta currentLogoUrl aqui para manter o preview se houve erro no save
             }

        } catch (error) { // Captura erros do upload ou validações locais
            console.error("Erro no handleCompanySubmit:", error);
             // O toast de erro da mutation tRPC é tratado no hook
             // Adiciona toast para erros locais (ex: upload)
             if (!(error instanceof TRPCError)) { // Evita toast duplicado se for erro do tRPC
                 toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao processar formulário" });
             }
        } finally {
             // O estado isSubmitting agora é derivado de updateCompanyMutation.isPending
             // e isUploadingApiRoute, não precisa de setIsSubmitting(false)
        }
    }, [toast, form, updateCompany, companySettingsQuery.data, wasImageRemoved]); // Adiciona dependências


    // Handlers onFileChange e onFileRemove (sem alterações, usam estado local e form.setValue)
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileSelect(e, (file) => form.setValue('logo', file, { shouldDirty: true, shouldValidate: true }), 
            setSelectedLogoName, 
            // Ajuste de tipo aqui para corrigir o erro de tipagem
            setCurrentLogoUrl as React.Dispatch<React.SetStateAction<string | undefined>>, 
            'logo', form);
        setWasImageRemoved(false); // Garante que flag de remoção é desmarcada ao selecionar novo arquivo
    };
    const onFileRemove = () => {
        // Passa a URL original da query para reverter o preview
        removeFile((file) => form.setValue('logo', file, { shouldDirty: true }), 
            setSelectedLogoName, 
            // Ajuste de tipo aqui para corrigir o erro de tipagem
            setCurrentLogoUrl as React.Dispatch<React.SetStateAction<string | undefined>>, 
            'logo', companySettingsQuery.data?.logoUrl ?? undefined, form);
        setWasImageRemoved(true); // Marca a intenção de remover a imagem atual
    };


    // --- Renderização ---
    return (
        <FormProvider {...form}>
            {/* Usar handleSubmit do react-hook-form */}
            <form onSubmit={form.handleSubmit(handleCompanySubmit)}>
                <Card>
                    <CardHeader><CardTitle>Informações da Empresa</CardTitle><CardDescription>Configure os dados da sua empresa</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        {/* Usar isLoading do hook */}
                        {isLoading ? (<Skeleton className="h-80 w-full" />) : (
                            <>
                                <div className="flex flex-col items-center sm:flex-row gap-6">
                                    {/* Logo Upload */}
                                    <FormField control={form.control} name="logo" render={({ field }) => ( // field aqui é para RHF, não usado diretamente no input
                                        <FormItem className="flex flex-col items-center space-y-2 flex-shrink-0">
                                            <Avatar className="h-24 w-24 rounded-md border bg-muted">
                                                {/* Usa currentLogoUrl do estado para preview */}
                                                <AvatarImage src={currentLogoUrl || '/placeholder-logo.svg'} alt={form.getValues('companyName') || 'Logo'} className="object-contain" />
                                                <AvatarFallback><Building className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                                            </Avatar>
                                            {/* O label aciona o input file */}
                                            <label htmlFor="logo-upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer", isSubmitting && "opacity-50 cursor-not-allowed")}>
                                                <Upload className="mr-2 h-4 w-4" /> Alterar logo
                                                <FormControl>
                                                     {/* Input file é controlado via estado/onChange */}
                                                    <Input id="logo-upload" type="file" className="hidden" accept="image/*"
                                                        onChange={onFileChange} // Chama handler local
                                                        disabled={isSubmitting} // Desabilita durante submit
                                                     />
                                                </FormControl>
                                            </label>
                                            <FormMessage /> {/* Mostra erros de validação do Zod */}
                                            {selectedLogoName && <p className="text-xs text-center text-muted-foreground">Selecionado: {selectedLogoName}</p>}
                                            {/* Botão para remover imagem selecionada/atual */}
                                            {(selectedLogoName || currentLogoUrl) && (
                                                <Button type="button" variant="ghost" size="sm" onClick={onFileRemove} disabled={isSubmitting} className="text-xs text-destructive hover:text-destructive/80">
                                                    Remover Imagem
                                                </Button>
                                            )}
                                        </FormItem>
                                    )} />
                                    {/* Company Fields */}
                                    <div className="flex-1 space-y-4 w-full">
                                        <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Nome da Empresa</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="cnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} placeholder="00.000.000/0000-00" /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </div>
                                <FormField control={form.control} name="companyAddress" render={({ field }) => (<FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* Ajustado para 2 colunas */}
                                    <FormField control={form.control} name="companyPhone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} placeholder="(XX) XXXXX-XXXX" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="companyEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        {/* Usar isSubmitting (combinado) e !form.formState.isDirty para desabilitar */}
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? (isUploadingApiRoute ? 'Enviando Logo...' : 'Salvando...') : 'Salvar Empresa'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}