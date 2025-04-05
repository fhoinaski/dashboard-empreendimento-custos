"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// Correção: Importar FormDescription aqui
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

// Schema
const apiKeysSchema = z.object({
    googleApiKey: z.string().optional().nullable(), // Allow null for clearing
    awsApiKey: z.string().optional().nullable(),
    awsSecretKey: z.string().optional().nullable(), // Added Secret Key
});

type ApiKeysFormData = z.infer<typeof apiKeysSchema>;

// Type for API status
interface ApiKeyStatus { googleConfigured: boolean; awsConfigured: boolean; }

export default function ApiKeysSettingsForm() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null);
    const [showKeys, setShowKeys] = useState(false);

    const form = useForm<ApiKeysFormData>({
        resolver: zodResolver(apiKeysSchema),
        defaultValues: { googleApiKey: '', awsApiKey: '', awsSecretKey: '' }, // Initialize with empty strings
    });

    // Fetch API Key Status
    const fetchApiKeyStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/api-keys');
            if (!response.ok) throw new Error("Falha ao buscar status das chaves");
            const data = await response.json();
            setApiKeyStatus(data);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível verificar as chaves de API." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchApiKeyStatus();
    }, [fetchApiKeyStatus]);

    const handleApiKeysSubmit = useCallback(async (values: ApiKeysFormData) => {
        setIsSubmitting(true);
        try {
            const keysToUpdate: Partial<ApiKeysFormData> = {};
            if (form.formState.dirtyFields.googleApiKey) keysToUpdate.googleApiKey = values.googleApiKey || null;
            if (form.formState.dirtyFields.awsApiKey) keysToUpdate.awsApiKey = values.awsApiKey || null;
            if (form.formState.dirtyFields.awsSecretKey) keysToUpdate.awsSecretKey = values.awsSecretKey || null;


            if (Object.keys(keysToUpdate).length === 0) {
                toast({ title: "Nenhuma alteração", description: "Nenhuma chave foi modificada ou fornecida." });
                setIsSubmitting(false);
                return;
            }


            const response = await fetch('/api/settings/api-keys', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keysToUpdate),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao salvar chaves de API');

            toast({ title: "Sucesso", description: data.message });
            form.reset({ googleApiKey: '', awsApiKey: '', awsSecretKey: '' }); // Clear inputs
            fetchApiKeyStatus(); // Refresh status
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao salvar chaves de API" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, form, fetchApiKeyStatus]); // Add form and fetchApiKeyStatus to dependencies

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleApiKeysSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Gerenciar Chaves de API</CardTitle>
                        <CardDescription>Configure as chaves para integrações (Google Drive, AWS S3, etc.). As chaves são armazenadas de forma segura.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (<Skeleton className="h-60 w-full" />) : apiKeyStatus === null ? (<p className="text-muted-foreground">Erro ao carregar status das chaves.</p>) : (
                            <>
                                {/* Google API Key */}
                                <FormField control={form.control} name="googleApiKey" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Chave API Google (JSON)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder={apiKeyStatus.googleConfigured ? "Chave configurada. Cole o novo JSON aqui para atualizar ou deixe em branco para manter." : "Cole o conteúdo do arquivo JSON da chave de serviço aqui..."}
                                                // Correção: Converter null/undefined para ''
                                                value={field.value ?? ''}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                rows={5}
                                                className="font-mono text-xs"
                                                disabled={isSubmitting}
                                            />
                                        </FormControl>
                                        {/* Correção: Usar FormDescription corretamente */}
                                        <FormDescription className="text-xs flex items-center gap-1">
                                            <Info className="h-3 w-3" />{apiKeyStatus.googleConfigured ? "Chave atualmente configurada." : "Nenhuma chave configurada."} Necessário para Google Drive e Sheets.
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
                                                        placeholder={apiKeyStatus.awsConfigured ? "••••••••••••••••••••" : "Cole seu Access Key ID..."}
                                                        // Correção: Converter null/undefined para ''
                                                        value={field.value ?? ''}
                                                        onChange={field.onChange}
                                                        onBlur={field.onBlur}
                                                        name={field.name}
                                                        ref={field.ref}
                                                        disabled={isSubmitting}
                                                    />
                                                </FormControl>
                                            </div>
                                             {/* Correção: Usar FormDescription corretamente */}
                                            <FormDescription className="text-xs flex items-center gap-1">
                                                <Info className="h-3 w-3" />{apiKeyStatus.awsConfigured ? "Chave(s) AWS configurada(s)." : "Nenhuma chave AWS configurada."} Necessário para upload de imagens.
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
                                                        placeholder={apiKeyStatus.awsConfigured ? "••••••••••••••••••••••••••••••••" : "Cole seu Secret Access Key..."}
                                                        // Correção: Converter null/undefined para ''
                                                        value={field.value ?? ''}
                                                        onChange={field.onChange}
                                                        onBlur={field.onBlur}
                                                        name={field.name}
                                                        ref={field.ref}
                                                        disabled={isSubmitting}
                                                    />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setShowKeys(!showKeys)} className="flex-shrink-0">
                                                    {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                {/* Adicionar outros campos de chave aqui */}
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Chaves
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}