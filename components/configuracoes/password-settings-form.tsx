"use client";

import React, { useState, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

// Schema
const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem",
    path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function PasswordSettingsForm() {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const handlePasswordSubmit = useCallback(async (values: PasswordFormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/settings/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao alterar senha');
            toast({ title: "Sucesso", description: data.message });
            form.reset();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao alterar senha" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, form]);

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handlePasswordSubmit)}>
                <Card>
                    <CardHeader><CardTitle>Alterar Senha</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="currentPassword" render={({ field }) => (
                            <FormItem><FormLabel>Senha Atual</FormLabel><FormControl><Input type="password" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="newPassword" render={({ field }) => (
                            <FormItem><FormLabel>Nova Senha</FormLabel><FormControl><Input type="password" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                            <FormItem><FormLabel>Confirmar Nova Senha</FormLabel><FormControl><Input type="password" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Alterar Senha
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}