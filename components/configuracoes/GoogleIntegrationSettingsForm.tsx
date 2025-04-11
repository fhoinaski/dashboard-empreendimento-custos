// FILE: components/configuracoes/GoogleIntegrationSettingsForm.tsx (Integrado e Refatorado)
// ============================================================
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Info, CheckCircle, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import type { UpdateTenantIntegrationSettingsInput } from '@/server/api/schemas/settings';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Schema Zod para o formulário
const integrationSchema = z.object({
    googleDriveEnabled: z.boolean(),
    googleSheetsEnabled: z.boolean(),
    googleServiceAccountJson: z
        .string()
        .optional()
        .nullable()
        .refine(
            (val) => {
                if (!val || val.trim() === '') return true;
                try {
                    const parsed = JSON.parse(val);
                    return typeof parsed === 'object' && parsed !== null && parsed.client_email && parsed.private_key;
                } catch (e) {
                    return false;
                }
            },
            { message: 'JSON inválido ou incompleto (faltam client_email/private_key).' }
        ),
});
type IntegrationFormData = z.infer<typeof integrationSchema>;

export default function GoogleIntegrationSettingsForm() {
    const { toast } = useToast();
    const [showJsonArea, setShowJsonArea] = useState(false);
    const [isRemovingJson, setIsRemovingJson] = useState(false);

    const {
        getTenantIntegrationSettings: integrationSettingsQuery,
        updateTenantIntegrationSettingsMutation,
        updateTenantIntegrationSettings,
    } = useSettings();

    const { data: currentSettings, isLoading: isLoadingSettings, refetch } = integrationSettingsQuery;
    const { mutateAsync: updateSettingsAction, isPending: isSubmitting } = updateTenantIntegrationSettingsMutation;

    const form = useForm<IntegrationFormData>({
        resolver: zodResolver(integrationSchema),
        defaultValues: {
            googleDriveEnabled: false,
            googleSheetsEnabled: false,
            googleServiceAccountJson: '',
        },
    });

    useEffect(() => {
        if (currentSettings) {
            form.reset({
                googleDriveEnabled: currentSettings.googleDriveEnabled,
                googleSheetsEnabled: currentSettings.googleSheetsEnabled,
                googleServiceAccountJson: '', // Não preenche com o JSON existente
            });
            setShowJsonArea(!currentSettings.googleServiceAccountConfigured);
            setIsRemovingJson(false);
        }
    }, [currentSettings, form]);

    const handleJsonPasteOrClear = (value: string | null) => {
        if (value === null) {
            setIsRemovingJson(true);
            form.setValue('googleServiceAccountJson', null, { shouldValidate: true, shouldDirty: true });
            setShowJsonArea(true);
        } else {
            setIsRemovingJson(false);
            form.setValue('googleServiceAccountJson', value, { shouldValidate: true, shouldDirty: true });
            setShowJsonArea(true);
        }
    };

    const handleIntegrationSubmit = useCallback(
        async (values: IntegrationFormData) => {
            try {
                const dataToSend: UpdateTenantIntegrationSettingsInput = {
                    googleDriveEnabled: values.googleDriveEnabled,
                    googleSheetsEnabled: values.googleSheetsEnabled,
                    googleServiceAccountJson: undefined,
                };

                if (isRemovingJson) {
                    dataToSend.googleServiceAccountJson = null;
                } else if (values.googleServiceAccountJson && values.googleServiceAccountJson.trim() !== '') {
                    dataToSend.googleServiceAccountJson = values.googleServiceAccountJson;
                }

                let hasChanges = false;
                if (currentSettings) {
                    if (values.googleDriveEnabled !== currentSettings.googleDriveEnabled) hasChanges = true;
                    if (values.googleSheetsEnabled !== currentSettings.googleSheetsEnabled) hasChanges = true;
                    if (dataToSend.googleServiceAccountJson !== undefined) hasChanges = true;
                } else {
                    if (values.googleDriveEnabled !== false) hasChanges = true;
                    if (values.googleSheetsEnabled !== false) hasChanges = true;
                    if (dataToSend.googleServiceAccountJson !== undefined) hasChanges = true;
                }

                if (!hasChanges) {
                    toast({ title: 'Nenhuma alteração', description: 'Nenhuma configuração foi modificada.' });
                    return;
                }

                console.log('[GIntegrationForm] Enviando dados:', {
                    ...dataToSend,
                    googleServiceAccountJson: dataToSend.googleServiceAccountJson
                        ? '*** Presente ***'
                        : dataToSend.googleServiceAccountJson === null
                        ? '*** Removendo ***'
                        : '*** Inalterado ***',
                });

                await updateTenantIntegrationSettings(dataToSend);

                refetch();
                setIsRemovingJson(false);
            } catch (error: any) {
                console.error('[GIntegrationForm] Erro ao salvar configurações:', error);
                // O hook useSettings já trata o toast de erro via onError
            }
        },
        [updateTenantIntegrationSettings, toast, currentSettings, refetch, isRemovingJson, form]
    );

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleIntegrationSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Integrações Google</CardTitle>
                        <CardDescription>
                            Habilite e configure o acesso ao Google Drive e Google Sheets para sua empresa/tenant.
                        </CardDescription>
                        {!isLoadingSettings && currentSettings && (
                            <div className="flex flex-wrap gap-2 pt-3">
                                <Badge
                                    variant={currentSettings.googleDriveEnabled ? 'default' : 'secondary'}
                                    className={cn(currentSettings.googleDriveEnabled && 'bg-green-100 text-green-800 border-green-300')}
                                >
                                    Drive: {currentSettings.googleDriveEnabled ? 'Ativo' : 'Inativo'}
                                </Badge>
                                <Badge
                                    variant={currentSettings.googleSheetsEnabled ? 'default' : 'secondary'}
                                    className={cn(currentSettings.googleSheetsEnabled && 'bg-green-100 text-green-800 border-green-300')}
                                >
                                    Sheets: {currentSettings.googleSheetsEnabled ? 'Ativo' : 'Inativo'}
                                </Badge>
                                <Badge
                                    variant={currentSettings.googleServiceAccountConfigured ? 'default' : 'destructive'}
                                    className={cn(
                                        currentSettings.googleServiceAccountConfigured
                                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                                            : 'bg-red-100 text-red-800 border-red-300'
                                    )}
                                >
                                    Credencial: {currentSettings.googleServiceAccountConfigured ? 'Configurada' : 'Pendente'}
                                </Badge>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoadingSettings ? (
                            <Skeleton className="h-60 w-full" />
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="googleDriveEnabled"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm">Google Drive</FormLabel>
                                                    <FormDescription className="text-xs">
                                                        Permitir upload e gestão de arquivos no Drive.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="googleSheetsEnabled"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm">Google Sheets</FormLabel>
                                                    <FormDescription className="text-xs">
                                                        Permitir sincronização de dados com Planilhas.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="googleServiceAccountJson"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Credenciais Google (JSON da Conta de Serviço)</FormLabel>
                                            {currentSettings?.googleServiceAccountConfigured && !showJsonArea && !isRemovingJson ? (
                                                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                                                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                                                        <CheckCircle className="h-4 w-4" /> Credencial configurada.
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setShowJsonArea(true)}
                                                            disabled={isSubmitting}
                                                        >
                                                            <Pencil className="h-4 w-4 mr-1" /> Alterar
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleJsonPasteOrClear(null)}
                                                            disabled={isSubmitting}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" /> Remover
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder={
                                                                isRemovingJson
                                                                    ? "Clique em 'Salvar' para remover a credencial existente."
                                                                    : "Cole aqui o conteúdo completo do arquivo JSON da sua Conta de Serviço Google Cloud..."
                                                            }
                                                            value={field.value ?? ''}
                                                            onChange={(e) => handleJsonPasteOrClear(e.target.value)}
                                                            onBlur={field.onBlur}
                                                            name={field.name}
                                                            ref={field.ref}
                                                            rows={8}
                                                            className="font-mono text-xs border-2"
                                                            disabled={isSubmitting || isRemovingJson}
                                                        />
                                                    </FormControl>
                                                    <FormDescription className="text-xs flex items-start gap-1">
                                                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                        <span>
                                                            Obtenha o JSON no Console do Google Cloud (IAM & Admin {'>'} Contas de Serviço). Certifique-se de
                                                            habilitar as APIs do Drive e Sheets.{' '}
                                                            <a
                                                                href="https://developers.google.com/workspace/guides/create-credentials#create_a_service_account"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary underline"
                                                            >
                                                                Saiba mais
                                                            </a>
                                                        </span>
                                                    </FormDescription>
                                                    <FormMessage />
                                                    {isRemovingJson && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="link"
                                                            className="text-xs h-auto p-0"
                                                            onClick={() => {
                                                                setIsRemovingJson(false);
                                                                form.setValue('googleServiceAccountJson', '');
                                                            }}
                                                        >
                                                            Cancelar remoção
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || isLoadingSettings || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Configurações Google
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}
// ============================================================
// FIM DO ARQUIVO INTEGRADO: components/configuracoes/GoogleIntegrationSettingsForm.tsx
// ============================================================