// components/configuracoes/notification-settings-form.tsx
"use client";

import React, { useEffect, useCallback } from 'react'; // Removido useState para loading/submitting
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast'; // Mantido para erros locais, se houver
// *** Importar o hook useSettings ***
import { useSettings } from '@/hooks/useSettings';
// *** Importar tipo de Input para a mutation ***
import type { UpdateNotificationSettingsInput } from '@/server/api/schemas/settings';
import { TRPCClientError } from '@trpc/client'; // Para checagem de erro

// Schema Zod local (deve corresponder ao schema do backend UpdateNotificationSettingsInput)
const notificationSchema = z.object({
    emailDespesasVencer: z.boolean(),
    emailDocumentosNovos: z.boolean(),
    emailRelatoriosSemanais: z.boolean(),
    systemDespesasVencer: z.boolean(),
    systemDocumentosNovos: z.boolean(),
    systemEventosCalendario: z.boolean(),
    antecedenciaVencimento: z.coerce.number().min(0, "Antecedência não pode ser negativa."), // Adicionada mensagem
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export default function NotificationSettingsForm() {
    const { toast } = useToast(); // Ainda pode ser útil para erros inesperados no componente

    // *** Usar o hook useSettings ***
    const {
        notificationSettingsQuery, // Query para buscar dados
        updateNotificationSettings, // Mutation para salvar
        isNotificationSettingsLoading, // Estado de loading da query
        updateNotificationSettingsMutation // Acesso ao estado da mutation
    } = useSettings();

    // Usar estados do hook
    const isLoading = isNotificationSettingsLoading;
    const isSubmitting = updateNotificationSettingsMutation.isPending;

    const form = useForm<NotificationFormData>({
        resolver: zodResolver(notificationSchema),
        // Valores padrão antes do fetch - o useEffect sobrescreverá
        defaultValues: {
            emailDespesasVencer: true,
            emailDocumentosNovos: true,
            emailRelatoriosSemanais: false,
            systemDespesasVencer: true,
            systemDocumentosNovos: true,
            systemEventosCalendario: true,
            antecedenciaVencimento: 3,
        }
    });

    // --- Preencher formulário com dados da query tRPC ---
    useEffect(() => {
        if (notificationSettingsQuery.data) {
            const data = notificationSettingsQuery.data;
            console.log("[NotificationForm] Data from tRPC query:", data);
            // Reseta o formulário com os dados buscados
            // Garante que todos os campos do schema local existam nos dados ou tenham defaults
            form.reset({
                emailDespesasVencer: data.emailDespesasVencer ?? true,
                emailDocumentosNovos: data.emailDocumentosNovos ?? true,
                emailRelatoriosSemanais: data.emailRelatoriosSemanais ?? false,
                systemDespesasVencer: data.systemDespesasVencer ?? true,
                systemDocumentosNovos: data.systemDocumentosNovos ?? true,
                systemEventosCalendario: data.systemEventosCalendario ?? true,
                antecedenciaVencimento: data.antecedenciaVencimento ?? 3,
            });
        }
        // O hook useSettings já trata erros da query com toast
    }, [notificationSettingsQuery.data, form]); // Depende apenas dos dados da query e form

    // --- handleNotificationSubmit usando tRPC Mutation ---
    const handleNotificationSubmit = useCallback(async (values: NotificationFormData) => {
        // O estado de loading 'isSubmitting' já é controlado pelo isPending da mutation
        console.log("[NotificationForm] Submitting values:", values);

        try {
            // Chama a mutation do hook useSettings
            // O tipo 'values' (NotificationFormData) deve ser compatível com UpdateNotificationSettingsInput
            await updateNotificationSettings(values as UpdateNotificationSettingsInput);

            // Hook já cuida do toast de sucesso e invalidação
            // Apenas reseta o estado 'dirty' do formulário
            form.reset(values, { keepDirty: false });

        } catch (error: unknown) {
            // Hook useSettings já exibe toast de erro do tRPC
            // Logar erro para depuração
            console.error("Erro ao salvar preferências (componente):", error);
             // Opcional: Exibir toast para erros inesperados que não sejam do tRPC
             // if (!(error instanceof TRPCClientError || (error instanceof Error && error.message.includes('[TRPCClientError]')))) {
             //    toast({ variant: "destructive", title: "Erro Inesperado", description: "Falha ao processar a solicitação." });
             // }
        }
        // isSubmitting é resetado automaticamente pela mutation
    }, [updateNotificationSettings, form, toast]); // Adicionar dependências corretas

    return (
        <FormProvider {...form}>
            {/* Usar handleSubmit do react-hook-form */}
            <form onSubmit={form.handleSubmit(handleNotificationSubmit)}>
                <Card>
                    <CardHeader><CardTitle>Preferências de Notificação</CardTitle><CardDescription>Configure como você deseja receber notificações</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        {/* Usar isLoading do hook */}
                        {isLoading ? ( <Skeleton className="h-[450px] w-full" /> ) : ( // Ajustado altura do Skeleton
                            <>
                                {/* Notificações por Email */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Notificações por Email</h3>
                                    <div className="space-y-4">
                                        {/* Campos usam disabled={isSubmitting} */}
                                        <FormField control={form.control} name="emailDespesasVencer" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Despesas a vencer</FormLabel><FormDescription className="text-xs">Emails sobre despesas próximas do vencimento.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl></FormItem> )}/>
                                        <FormField control={form.control} name="emailDocumentosNovos" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Novos documentos</FormLabel><FormDescription className="text-xs">Emails quando novos documentos forem adicionados.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem> )}/>
                                        <FormField control={form.control} name="emailRelatoriosSemanais" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Relatórios semanais</FormLabel><FormDescription className="text-xs">Receba resumos semanais por email.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem> )}/>
                                    </div>
                                </div>
                                <Separator />
                                {/* Notificações no Sistema */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Notificações no Sistema</h3>
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="systemDespesasVencer" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Despesas a vencer</FormLabel><FormDescription className="text-xs">Alertas no sistema sobre despesas próximas.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem> )}/>
                                        <FormField control={form.control} name="systemDocumentosNovos" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Novos documentos</FormLabel><FormDescription className="text-xs">Alertas sobre novos documentos adicionados.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem> )}/>
                                        <FormField control={form.control} name="systemEventosCalendario" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-sm">Eventos do calendário</FormLabel><FormDescription className="text-xs">Lembretes sobre eventos do calendário.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem> )}/>
                                    </div>
                                </div>
                                <Separator />
                                {/* Configurações Avançadas */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Configurações Avançadas</h3>
                                    <FormField control={form.control} name="antecedenciaVencimento" render={({ field }) => (
                                        <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 gap-4 sm:gap-2">
                                            <div className="space-y-0.5 flex-grow"><FormLabel className="text-sm">Antecedência (dias)</FormLabel><FormDescription className="text-xs">Dias antes do vencimento para notificar sobre despesas.</FormDescription></div>
                                            <FormControl><Input type="number" min="0" className="w-full sm:w-20" {...field} onChange={event => field.onChange(+event.target.value)} disabled={isSubmitting} /></FormControl>
                                            <FormMessage /> {/* Adicionado para erro de validação */}
                                        </FormItem>
                                    )} />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        {/* Botão usa isSubmitting da mutation e !form.formState.isDirty */}
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Salvando...' : 'Salvar Preferências'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}