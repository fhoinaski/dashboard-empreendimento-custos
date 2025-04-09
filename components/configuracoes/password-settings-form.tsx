// components/configuracoes/password-settings-form.tsx
"use client";

import React, { useState, useCallback } from 'react'; // Removido useState se não for mais necessário
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Eye, EyeOff } from 'lucide-react'; // Adicionado Eye, EyeOff
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
// *** Importar o hook useSettings ***
import { useSettings } from '@/hooks/useSettings';
// *** Importar o tipo de input para a mutation ***
import type { ChangePasswordInput } from '@/server/api/schemas/settings';
import { TRPCClientError } from '@trpc/client'; // Para checagem de erro


// Schema Zod (sem alterações)
const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha: mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "As novas senhas não coincidem",
    path: ["confirmPassword"], // Aplica erro ao campo de confirmação
});

// Mantém o tipo do formulário
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function PasswordSettingsForm() {
    const { toast } = useToast();
    // Estado local para controlar visibilidade da senha
    const [showPasswords, setShowPasswords] = useState(false);

    // *** Usar o hook useSettings ***
    const {
        changePassword, // Função de ação da mutation
        changePasswordMutation // Acesso direto à mutation para isPending
    } = useSettings();

    // Usar isPending da mutation para estado de submitting
    const isSubmitting = changePasswordMutation.isPending;

    const form = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
        mode: 'onChange', // Adicionar validação onChange
    });

    // --- handlePasswordSubmit usando tRPC Mutation ---
    const handlePasswordSubmit = useCallback(async (values: PasswordFormData) => {
        // O estado de loading (isSubmitting) já é controlado pelo isPending da mutation

        // Prepara os dados conforme esperado pela ChangePasswordInput
        const dataToSend: ChangePasswordInput = {
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            // confirmPassword não é enviado para o backend
        };

        try {
            // Chama a função changePassword do hook
            await changePassword(dataToSend);

            // O hook já cuida do toast de sucesso
            form.reset(); // Limpa o formulário após sucesso

        } catch (error: unknown) {
            // O hook useSettings já exibe um toast de erro genérico
            // Podemos adicionar logs específicos se necessário
            console.error("Erro ao alterar senha (componente):", error);
             // Opcional: Mostrar um toast mais específico se o hook não o fizer
             // if (!(error instanceof TRPCClientError)) { // Evita duplicar toast do hook
             //     toast({ variant: "destructive", title: "Erro Inesperado", description: "Falha ao processar a alteração de senha." });
             // }
        }
        // O estado isSubmitting é resetado automaticamente quando a mutation termina (onSettled no hook, implicitamente)
    }, [changePassword, form, toast]); // Incluir changePassword e form nas dependências

    return (
        <FormProvider {...form}>
            {/* Usar handleSubmit do react-hook-form */}
            <form onSubmit={form.handleSubmit(handlePasswordSubmit)}>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Alterar Senha</CardTitle>
                         {/* Botão para mostrar/esconder senhas */}
                         <Button type="button" variant="ghost" size="icon" onClick={() => setShowPasswords(!showPasswords)} className="h-8 w-8 text-muted-foreground">
                            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            <span className="sr-only">{showPasswords ? 'Esconder senhas' : 'Mostrar senhas'}</span>
                         </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="currentPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Senha Atual</FormLabel>
                                <FormControl>
                                    <Input type={showPasswords ? "text" : "password"} {...field} disabled={isSubmitting} autoComplete="current-password" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="newPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nova Senha</FormLabel>
                                <FormControl>
                                    <Input type={showPasswords ? "text" : "password"} {...field} disabled={isSubmitting} autoComplete="new-password" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Confirmar Nova Senha</FormLabel>
                                <FormControl>
                                    <Input type={showPasswords ? "text" : "password"} {...field} disabled={isSubmitting} autoComplete="new-password" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        {/* Usa isSubmitting da mutation */}
                        <Button type="submit" disabled={isSubmitting || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}