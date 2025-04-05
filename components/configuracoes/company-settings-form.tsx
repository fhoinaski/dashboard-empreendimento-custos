"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Save, Loader2, Building } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'; // Import Form components
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { handleFileSelect, removeFile } from './settings-helpers'; // Import helpers

// Schema (mantido com nullable)
const companySchema = z.object({
    companyName: z.string().optional().nullable(),
    cnpj: z.string().optional().nullable(),
    companyAddress: z.string().optional().nullable(),
    companyPhone: z.string().optional().nullable(),
    companyEmail: z.string().email("Email inválido").optional().nullable(),
    // CORREÇÃO: Use z.any() ou z.unknown() aqui
    logo: z.any() // Mude de z.instanceof(File) para z.any()
        .optional()
        .nullable()
        .refine(file => !file || file.size <= 2 * 1024 * 1024, `Logo excede 2MB.`)
        .refine(file => !file || ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'].includes(file.type), `Tipo de logo inválido.`),
});


type CompanyFormData = z.infer<typeof companySchema>;
interface CompanySettingsData { companyName?: string; cnpj?: string; companyAddress?: string; companyPhone?: string; companyEmail?: string; logoUrl?: string }

export default function CompanySettingsForm() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [companySettings, setCompanySettings] = useState<CompanySettingsData | null>(null);
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string | undefined>(undefined);
    const [selectedLogoName, setSelectedLogoName] = useState<string | null>(null);

    const form = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            companyName: '', cnpj: '', companyAddress: '', companyPhone: '',
            companyEmail: '', logo: null
        },
    });

    // Fetch initial data
    useEffect(() => {
        let isMounted = true;
        async function fetchCompanyData() {
            setIsLoading(true);
            try {
                const response = await fetch('/api/settings/company');
                if (!response.ok) throw new Error("Falha ao buscar configurações da empresa");
                const data = await response.json();
                if (isMounted) {
                    setCompanySettings(data);
                    const defaults = {
                        companyName: data?.companyName ?? '', // Convert null/undefined to ''
                        cnpj: data?.cnpj ?? '',
                        companyAddress: data?.companyAddress ?? '',
                        companyPhone: data?.companyPhone ?? '',
                        companyEmail: data?.companyEmail ?? '',
                       
                        logo: null
                    };
                    form.reset(defaults);
                    setCurrentLogoUrl(data?.logoUrl);
                }
            } catch (error) {
                if(isMounted){
                    console.error(error);
                    toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as configurações da empresa." });
                }
            } finally {
                if(isMounted) setIsLoading(false);
            }
        }
        fetchCompanyData();
        return () => { isMounted = false };
    }, [form, toast]);

    const handleCompanySubmit = useCallback(async (values: CompanyFormData) => {
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            Object.entries(values).forEach(([key, value]) => {
                if (key === 'logo') return;
                 // Envia string vazia se for null/undefined, mas apenas se for modificado
                 if (form.formState.dirtyFields[key as keyof CompanyFormData]) {
                    formData.append(key, value ?? ''); // Envia '' para limpar o campo no backend se necessário
                 }
            });
            if (values.logo) formData.append('logo', values.logo);

            const response = await fetch('/api/settings/company', { method: 'PUT', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao salvar informações da empresa');

            toast({ title: "Sucesso", description: data.message });
            setCurrentLogoUrl(data.settings.logoUrl);
            setSelectedLogoName(null);
            // Reset form with potentially updated values, keep logo null
             form.reset({
                ...values, // Use os valores submetidos como base
                companyName: data.settings.companyName ?? '', // Garante que é string
                cnpj: data.settings.cnpj ?? '',
                companyAddress: data.settings.companyAddress ?? '',
                companyPhone: data.settings.companyPhone ?? '',
                companyEmail: data.settings.companyEmail ?? '',
               
                logo: null // Reset campo do arquivo
             }, { keepDirty: false }); // Marca o form como não sujo


        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao salvar informações da empresa" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, form]); // Adicionado 'form' às dependências

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileSelect(e, (file) => form.setValue('logo', file, { shouldDirty: true, shouldValidate: true }), setSelectedLogoName, setCurrentLogoUrl, 'logo', form);
    };

     const onFileRemove = () => {
        removeFile((file) => form.setValue('logo', file, { shouldDirty: true }), setSelectedLogoName, setCurrentLogoUrl, 'logo', companySettings?.logoUrl, form);
    };


    return (
        <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleCompanySubmit)}>
                <Card>
                    <CardHeader><CardTitle>Informações da Empresa</CardTitle><CardDescription>Configure os dados da sua empresa</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (<Skeleton className="h-80 w-full" />) : (
                            <>
                                <div className="flex flex-col items-center sm:flex-row gap-6">
                                    {/* Logo Upload */}
                                    <FormField control={form.control} name="logo" render={({ field }) => (
                                        <FormItem className="flex flex-col items-center space-y-2 flex-shrink-0">
                                            <Avatar className="h-24 w-24 rounded-md border bg-muted">
                                                <AvatarImage src={currentLogoUrl || '/placeholder-logo.svg'} alt={form.getValues('companyName') || 'Logo'} className="object-contain" />
                                                <AvatarFallback><Building className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                                            </Avatar>
                                            <label htmlFor="logo-upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                                                <Upload className="mr-2 h-4 w-4" /> Alterar logo
                                                <FormControl>
                                                    <Input id="logo-upload" type="file" className="hidden" accept="image/*" onChange={onFileChange} />
                                                </FormControl>
                                            </label>
                                            <FormMessage />
                                            {selectedLogoName && <p className="text-xs text-center text-muted-foreground">Selecionado: {selectedLogoName}</p>}
                                        </FormItem>
                                    )} />
                                    {/* Company Fields */}
                                    <div className="flex-1 space-y-4 w-full">
                                        {/* Correção: Adicionar value={field.value ?? ''} */}
                                        <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Nome da Empresa</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                        {/* Correção: Adicionar value={field.value ?? ''} */}
                                        <FormField control={form.control} name="cnpj" render={({ field }) => (<FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </div>
                                {/* Correção: Adicionar value={field.value ?? ''} */}
                                <FormField control={form.control} name="companyAddress" render={({ field }) => (<FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Correção: Adicionar value={field.value ?? ''} */}
                                    <FormField control={form.control} name="companyPhone" render={({ field }) => (<FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                    {/* Correção: Adicionar value={field.value ?? ''} */}
                                    <FormField control={form.control} name="companyEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>)} />
                                    {/* Correção: Adicionar value={field.value ?? ''} */}
                                    
                                </div>
                                
                              
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Empresa
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </FormProvider>
    );
}