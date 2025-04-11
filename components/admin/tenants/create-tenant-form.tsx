// ============================================================
// NEW FILE: components/admin/tenants/create-tenant-form.tsx
// ============================================================
"use client";

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useTenants } from '@/hooks/useTenants'; // Hook para a ação de criar
import { createTenantWithAdminInputSchema, CreateTenantWithAdminInput } from '@/server/api/schemas/tenants'; // Importar schema e tipo
import { Loader2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { DialogFooter, DialogClose } from '@/components/ui/dialog'; // Importar para botões

interface CreateTenantFormProps {
    onSuccess?: () => void; // Callback opcional para fechar o dialog
}

export default function CreateTenantForm({ onSuccess }: CreateTenantFormProps) {
    const { createTenant, isCreatingTenant } = useTenants();
    const [showPassword, setShowPassword] = useState(false);

    const form = useForm<CreateTenantWithAdminInput>({
        resolver: zodResolver(createTenantWithAdminInputSchema),
        defaultValues: {
            tenantName: '',
            adminName: '',
            adminEmail: '',
            adminPassword: '',
            plan: 'free',
            slug: '', // Deixar vazio para gerar automaticamente se desejado
        },
        mode: 'onChange',
    });

    const onSubmit = async (values: CreateTenantWithAdminInput) => {
        // Remover slug se estiver vazio para permitir geração automática no backend
        const dataToSend = { ...values };
        if (dataToSend.slug === '') {
            delete dataToSend.slug;
        }
        const result = await createTenant(dataToSend);
        if (onSuccess && result) { // Verifica se a operação foi bem-sucedida
            onSuccess(); // Chama o callback para fechar o dialog
            form.reset(); // Limpa o formulário
        }
    };

    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 max-h-[65vh] overflow-y-auto px-1">
                {/* Tenant Info */}
                <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome do Tenant *</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: Construtora Exemplo Ltda" {...field} disabled={isCreatingTenant} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Slug (Identificador URL)</FormLabel>
                            <FormControl>
                                <Input placeholder="construtora-exemplo (opcional, será gerado)" {...field} disabled={isCreatingTenant} />
                            </FormControl>
                             <FormDescription className="text-xs">Use letras minúsculas, números e hífens. Se vazio, será gerado automaticamente.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Plano Inicial *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={isCreatingTenant}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="free">Free (Grátis)</SelectItem>
                                    <SelectItem value="basic">Básico</SelectItem>
                                    <SelectItem value="pro">Pro</SelectItem>
                                    <SelectItem value="enterprise">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                 {/* Admin Info */}
                 <h3 className="text-md font-semibold pt-4 border-t mt-6">Administrador Principal</h3>
                 <FormField
                    control={form.control}
                    name="adminName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nome do Admin *</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: João Silva" {...field} disabled={isCreatingTenant} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="adminEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email do Admin *</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="admin@exemplo.com" {...field} disabled={isCreatingTenant} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="adminPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Senha do Admin *</FormLabel>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Input type={showPassword ? "text" : "password"} placeholder="Mínimo 8 caracteres" {...field} disabled={isCreatingTenant} />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword(!showPassword)} className="flex-shrink-0 h-8 w-8">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <DialogFooter className="pt-6 sticky bottom-0 bg-background pb-1">
                    <DialogClose asChild>
                        <Button variant="outline" type="button" disabled={isCreatingTenant}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isCreatingTenant || !form.formState.isValid}>
                        {isCreatingTenant && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <UserPlus className="mr-2 h-4 w-4" /> Criar Tenant e Admin
                    </Button>
                </DialogFooter>
            </form>
        </FormProvider>
    );
}
// ============================================================
// END OF FILE
// ============================================================