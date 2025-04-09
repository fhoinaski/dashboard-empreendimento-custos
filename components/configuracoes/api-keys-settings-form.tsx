// components/configuracoes/api-keys-settings-form.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast'; // Mantido para toasts locais
// *** Importar o hook useSettings ***
import { useSettings } from '@/hooks/useSettings';
// *** Importar tipo de Input para a mutation ***
import type { UpdateApiKeysInput } from '@/server/api/schemas/settings';
import { TRPCClientError } from '@trpc/client'; // Para checagem de erro

// Schema Zod local (sem alterações)
const apiKeysSchema = z.object({
    googleApiKey: z.string().optional().nullable(),
    awsApiKey: z.string().optional().nullable(),
    awsSecretKey: z.string().optional().nullable(),
});
type ApiKeysFormData = z.infer<typeof apiKeysSchema>;

// Remover interface local ApiKeyStatus, usar o tipo da query
// interface ApiKeyStatus { googleConfigured: boolean; awsConfigured: boolean; }

export default function ApiKeysSettingsForm() {
    const { toast } = useToast(); // Usado para toast de "Nenhuma alteração"
    // Remover estados locais de loading/submitting
    // const [isLoading, setIsLoading] = useState(true); // REMOVED
    // const [isSubmitting, setIsSubmitting] = useState(false); // REMOVED
    // Remover estado local apiKeyStatus, usar dados da query
    // const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null); // REMOVED
    const [showKeys, setShowKeys] = useState(false); // Manter estado local para UI

    // *** Usar o hook useSettings ***
    const {
        apiKeysQuery, // Query para buscar status das chaves
        updateApiKeys, // Mutation para salvar
        isApiKeysLoading, // Estado de loading da query
        updateApiKeysMutation // Acesso ao estado da mutation
    } = useSettings();

    // Usar estados do hook
    const isLoading = isApiKeysLoading;
    const isSubmitting = updateApiKeysMutation.isPending;
    // Dados do status das chaves vêm da query
    const apiKeyStatus = apiKeysQuery.data;

    const form = useForm<ApiKeysFormData>({
        resolver: zodResolver(apiKeysSchema),
        // Inputs iniciam vazios, placeholder indicará status
        defaultValues: { googleApiKey: '', awsApiKey: '', awsSecretKey: '' },
    });

    // Remover fetchApiKeyStatus e useEffect relacionado, pois a query tRPC cuida disso

    // --- handleApiKeysSubmit usando tRPC Mutation ---
    const handleApiKeysSubmit = useCallback(async (values: ApiKeysFormData) => {
        // isSubmitting é controlado pelo isPending da mutation

        // Preparar dados para a mutation (apenas campos alterados)
        const dataToUpdate: UpdateApiKeysInput = {}; // Garante conformidade com o tipo
        let hasChanges = false;

        if (form.formState.dirtyFields.googleApiKey) {
            dataToUpdate.googleApiKey = values.googleApiKey || null; // Envia null se vazio
            hasChanges = true;
        }
        if (form.formState.dirtyFields.awsApiKey) {
            dataToUpdate.awsApiKey = values.awsApiKey || null;
            hasChanges = true;
        }
        if (form.formState.dirtyFields.awsSecretKey) {
            dataToUpdate.awsSecretKey = values.awsSecretKey || null;
            hasChanges = true;
        }

        if (!hasChanges) {
            toast({ title: "Nenhuma alteração", description: "Nenhuma chave foi modificada ou fornecida." });
            return; // Sai se nada mudou
        }

        console.log('[ApiKeysForm] Data to update via tRPC:', dataToUpdate);

        try {
            // Chama a mutation do hook useSettings
            await updateApiKeys(dataToUpdate);

            // Hook já lida com toast de sucesso e invalidação da query apiKeysQuery
            form.reset({ googleApiKey: '', awsApiKey: '', awsSecretKey: '' }); // Limpa inputs após sucesso

        } catch (error: unknown) {
            // Hook useSettings já exibe toast de erro do tRPC
            console.error("Erro ao salvar chaves API (componente):", error);
            // Opcional: adicionar toast para erros inesperados locais
            // if (!(error instanceof TRPCClientError || (error instanceof Error && error.message.includes('[TRPCClientError]')))) {
            //    toast({ variant: "destructive", title: "Erro Inesperado", description: "Falha ao processar a solicitação." });
            // }
        }
        // isSubmitting é resetado automaticamente pela mutation
    }, [form, updateApiKeys, toast]); // Adicionar dependências

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleApiKeysSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Gerenciar Chaves de API</CardTitle>
                        <CardDescription>Configure as chaves para integrações (Google Drive, AWS S3, etc.). As chaves são armazenadas de forma segura.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Usar isLoading do hook */}
                        {isLoading ? (<Skeleton className="h-60 w-full" />)
                         // Usar dados de apiKeyStatus da query
                         : !apiKeyStatus ? (<p className="text-muted-foreground">Erro ao carregar status das chaves.</p>)
                         : (
                            <>
                                {/* Google API Key */}
                                <FormField control={form.control} name="googleApiKey" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Chave API Google (JSON)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={apiKeyStatus.googleConfigured ? "Chave configurada. Cole o novo JSON aqui para atualizar ou deixe em branco para manter." : "Cole o conteúdo do arquivo JSON da chave de serviço aqui..."}
                                                value={field.value ?? ''} // Mantém controle do react-hook-form
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                rows={5}
                                                className="font-mono text-xs"
                                                disabled={isSubmitting} // Usa isSubmitting do hook
                                            />
                                        </FormControl>
                                        <FormDescription className="text-xs flex items-center gap-1">
                                            <Info className="h-3 w-3" />
                                            {/* Usa dados da query */}
                                            {apiKeyStatus.googleConfigured ? "Chave atualmente configurada." : "Nenhuma chave configurada."} Necessário para Google Drive e Sheets.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Separator />
                                {/* AWS Keys */}
                                <div className='space-y-4'>
                                    <FormField control={form.control} name="awsApiKey" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Chave API AWS S3 (Access Key ID)</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input
                                                        type={showKeys ? "text" : "password"}
                                                        // Usa dados da query no placeholder
                                                        placeholder={apiKeyStatus.awsConfigured ? "••••••••••••••••••••" : "Cole seu Access Key ID..."}
                                                        value={field.value ?? ''} // Mantém controle RHF
                                                        onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                                                        disabled={isSubmitting} // Usa isSubmitting do hook
                                                        autoComplete="off" // Desliga autocomplete
                                                    />
                                                </FormControl>
                                                {/* Botão mostrar/esconder (sem alterações) */}
                                            </div>
                                            <FormDescription className="text-xs flex items-center gap-1">
                                                <Info className="h-3 w-3" />
                                                {/* Usa dados da query */}
                                                {apiKeyStatus.awsConfigured ? "Chave(s) AWS configurada(s)." : "Nenhuma chave AWS configurada."} Necessário para upload de imagens.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="awsSecretKey" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Chave API AWS S3 (Secret Access Key)</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input
                                                        type={showKeys ? "text" : "password"}
                                                         // Usa dados da query no placeholder
                                                        placeholder={apiKeyStatus.awsConfigured ? "••••••••••••••••••••••••••••••••" : "Cole seu Secret Access Key..."}
                                                        value={field.value ?? ''} // Mantém controle RHF
                                                        onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref}
                                                        disabled={isSubmitting} // Usa isSubmitting do hook
                                                        autoComplete="off" // Desliga autocomplete
                                                    />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setShowKeys(!showKeys)} className="flex-shrink-0 h-8 w-8"> {/* Ajustado tamanho */}
                                                    {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    <span className="sr-only">{showKeys ? 'Esconder Chaves' : 'Mostrar Chaves'}</span>
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                         {/* Usa isSubmitting e isLoading do hook */}
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Salvando...' : 'Salvar Chaves'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}