"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

// Schema
const notificationSchema = z.object({
    emailDespesasVencer: z.boolean(),
    emailDocumentosNovos: z.boolean(),
    emailRelatoriosSemanais: z.boolean(),
    systemDespesasVencer: z.boolean(),
    systemDocumentosNovos: z.boolean(),
    systemEventosCalendario: z.boolean(),
    antecedenciaVencimento: z.coerce.number().min(0),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export default function NotificationSettingsForm() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<NotificationFormData>({
        resolver: zodResolver(notificationSchema),
        defaultValues: { // Default values before fetching
            emailDespesasVencer: true,
            emailDocumentosNovos: true,
            emailRelatoriosSemanais: false,
            systemDespesasVencer: true,
            systemDocumentosNovos: true,
            systemEventosCalendario: true,
            antecedenciaVencimento: 3,
        }
    });

    // Fetch initial data
    useEffect(() => {
        let isMounted = true;
        async function fetchNotificationData() {
            setIsLoading(true);
            try {
                const response = await fetch('/api/settings/notifications');
                if (!response.ok) throw new Error("Falha ao buscar preferências");
                const data = await response.json();
                if (isMounted) {
                    form.reset(data);
                }
            } catch (error) {
                if (isMounted) {
                    console.error(error);
                    toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as preferências de notificação." });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        fetchNotificationData();
        return () => { isMounted = false };
    }, [form, toast]);

    const handleNotificationSubmit = useCallback(async (values: NotificationFormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/settings/notifications', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao salvar preferências');
            toast({ title: "Sucesso", description: data.message });
             // Reset dirty state after successful save
             form.reset(values);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao salvar preferências" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, form]);

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleNotificationSubmit)}>
                <Card>
                    <CardHeader><CardTitle>Preferências de Notificação</CardTitle><CardDescription>Configure como você deseja receber notificações</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (<Skeleton className="h-60 w-full" />) : (
                            <>
                                {/* Notificações por Email */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Notificações por Email</h3>
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="emailDespesasVencer" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Despesas a vencer</FormLabel><FormMessage className="text-xs">Emails sobre despesas próximas do vencimento</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} /></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="emailDocumentosNovos" render={({ field }) => (
                                             <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Novos documentos</FormLabel><FormMessage className="text-xs">Emails quando novos documentos forem adicionados</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="emailRelatoriosSemanais" render={({ field }) => (
                                             <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Relatórios semanais</FormLabel><FormMessage className="text-xs">Receba relatórios semanais por email</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>
                                        )} />
                                    </div>
                                </div>
                                <Separator />
                                {/* Notificações no Sistema */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Notificações no Sistema</h3>
                                    <div className="space-y-4">
                                         <FormField control={form.control} name="systemDespesasVencer" render={({ field }) => (
                                             <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Despesas a vencer</FormLabel><FormMessage className="text-xs">Alertas no sistema sobre despesas próximas</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>
                                         )} />
                                        <FormField control={form.control} name="systemDocumentosNovos" render={({ field }) => (
                                             <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Novos documentos</FormLabel><FormMessage className="text-xs">Alertas sobre novos documentos adicionados</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>
                                        )} />
                                        <FormField control={form.control} name="systemEventosCalendario" render={({ field }) => (
                                             <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Eventos do calendário</FormLabel><FormMessage className="text-xs">Alertas sobre eventos do calendário</FormMessage></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/></FormControl></FormItem>
                                        )} />
                                    </div>
                                </div>
                                <Separator />
                                {/* Configurações Avançadas */}
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Configurações Avançadas</h3>
                                    <FormField control={form.control} name="antecedenciaVencimento" render={({ field }) => (
                                        <FormItem className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5 mb-2 sm:mb-0"><FormLabel>Antecedência (dias)</FormLabel><FormMessage className="text-xs">Dias antes do vencimento para notificar</FormMessage></div>
                                            <FormControl><Input type="number" min="0" className="w-full sm:w-20" {...field} disabled={isSubmitting} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Preferências
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}