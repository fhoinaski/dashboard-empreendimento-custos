"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Save, Loader2, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { handleFileSelect, removeFile } from './settings-helpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const profileSchema = z.object({
    name: z.string().min(3, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    // CORREÇÃO: Use z.any() ou z.unknown() aqui
    avatar: z.any() // Mude de z.instanceof(File) para z.any()
        .optional()
        .nullable()
        .refine(file => !file || (typeof window !== 'undefined' && file instanceof File), {
            message: "Arquivo inválido. Selecione um arquivo válido.",
        })
        .refine(file => !file || (typeof window !== 'undefined' && file instanceof File && file.size <= MAX_AVATAR_SIZE_BYTES), {
            message: `Avatar excede ${MAX_AVATAR_SIZE_BYTES / 1024 / 1024}MB.`
        })
        .refine(file => !file || (typeof window !== 'undefined' && file instanceof File && ACCEPTED_AVATAR_TYPES.includes(file.type)), {
            message: `Tipo de avatar inválido (${ACCEPTED_AVATAR_TYPES.join(', ')}).`
        }),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfileSettingsForm() {
    const { data: session, status, update } = useSession();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);
    const [selectedAvatarName, setSelectedAvatarName] = useState<string | null>(null);

    const form = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: '', email: '', avatar: null },
    });

    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
            console.log("[ProfileSettingsForm useEffect] Session data received:", {
                name: session.user.name,
                email: session.user.email,
                avatarUrl: session.user.avatarUrl || session.user.image
            });
            form.reset({
                name: session.user.name || '',
                email: session.user.email || '',
                avatar: null
            }, {
                keepValues: false,
                keepDirty: false,
                keepErrors: false,
            });
            setCurrentAvatarUrl(session.user.avatarUrl || session.user.image || undefined);
            setIsLoading(false);
        } else if (status === 'unauthenticated' || status === 'loading') {
            console.log("[ProfileSettingsForm useEffect] Status:", status);
            setIsLoading(status === 'loading');
            if (status === 'unauthenticated') {
                form.reset({ name: '', email: '', avatar: null });
                setCurrentAvatarUrl(undefined);
            }
        }
    }, [session, status, form]);

    const handleProfileSubmit = useCallback(async (values: ProfileFormData) => {
        setIsSubmitting(true);
        console.log("[ProfileSubmit] Form values received:", {
            name: values.name,
            email: values.email,
            avatar: values.avatar ? values.avatar.name : null
        });

        try {
            const formData = new FormData();
            let requiresUpdate = false;

            if (form.formState.dirtyFields.name) {
                formData.append('name', values.name);
                requiresUpdate = true;
                console.log("[ProfileSubmit] Name changed:", values.name);
            }
            if (values.avatar instanceof File) {
                formData.append('avatar', values.avatar, values.avatar.name);
                requiresUpdate = true;
                console.log("[ProfileSubmit] Avatar file selected:", values.avatar.name);
            }

            if (!requiresUpdate) {
                toast({ title: "Nenhuma alteração", description: "Nenhum dado foi modificado para salvar." });
                setIsSubmitting(false);
                return;
            }

            console.log("[ProfileSubmit] Sending PUT request to /api/settings/profile");
            const response = await fetch('/api/settings/profile', { method: 'PUT', body: formData });
            const data = await response.json();

            console.log("[ProfileSubmit] API Response:", {
                status: response.status,
                name: data.user?.name,
                email: data.user?.email,
                avatarUrl: data.user?.avatarUrl
            });

            if (!response.ok) {
                throw new Error(data.error || `Falha ao salvar perfil (${response.status})`);
            }
            if (!data.user || !data.user.name || !data.user.email) {
                throw new Error("Resposta inválida do servidor após atualização.");
            }

            toast({ title: "Sucesso", description: data.message || "Perfil atualizado." });

            // Atualizar a sessão explicitamente
            console.log("[ProfileSubmit] Updating session with:", {
                name: data.user.name,
                avatarUrl: data.user.avatarUrl
            });
            await update({
                name: data.user.name,
                avatarUrl: data.user.avatarUrl
            });

            // Resetar o formulário e atualizar a UI
            form.reset({
                name: data.user.name,
                email: data.user.email,
                avatar: null
            }, { keepDirty: false });

            // Adicionar timestamp para forçar re-renderização e evitar cache de imagem
            const newAvatarUrl = data.user.avatarUrl ? `${data.user.avatarUrl}?t=${Date.now()}` : undefined;
            setCurrentAvatarUrl(newAvatarUrl);
            setSelectedAvatarName(null);

            // Forçar a recarga da sessão
            console.log("[ProfileSubmit] Forcing session refresh...");
            await fetch('/api/auth/session', { method: 'GET' });

        } catch (error) {
            console.error("[ProfileSubmit] Error:", error);
            toast({ variant: "destructive", title: "Erro", description: error instanceof Error ? error.message : "Falha ao salvar perfil" });
        } finally {
            setIsSubmitting(false);
        }
    }, [toast, update, form]);

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileSelect(
            e,
            (file: File | null) => form.setValue('avatar', file, { shouldDirty: true, shouldValidate: true }),
            setSelectedAvatarName,
            setCurrentAvatarUrl,
            'avatar',
            form,
            MAX_AVATAR_SIZE_BYTES,
            ACCEPTED_AVATAR_TYPES
        );
        if (e.target.files?.[0]) {
            console.log("[onFileChange] Avatar selected:", e.target.files[0].name);
        }
    };

    const onFileRemove = () => {
        const originalAvatar = session?.user?.avatarUrl || session?.user?.image || undefined;
        removeFile(
            (file: File | null) => form.setValue('avatar', file, { shouldDirty: true }),
            setSelectedAvatarName,
            setCurrentAvatarUrl,
            'avatar',
            originalAvatar,
            form
        );
        console.log("[onFileRemove] Avatar removed, reverting to:", originalAvatar);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48 mt-2" /></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col items-center sm:flex-row gap-6">
                        <div className="flex flex-col items-center space-y-2 flex-shrink-0">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <Skeleton className="h-8 w-32" />
                        </div>
                        <div className="flex-1 space-y-4 w-full">
                            <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
            </Card>
        );
    }

    return (
        <FormProvider {...form}>
            <TooltipProvider>
                <form onSubmit={form.handleSubmit(handleProfileSubmit)}>
                    <Card>
                        <CardHeader><CardTitle>Informações de Perfil</CardTitle><CardDescription>Atualize suas informações pessoais</CardDescription></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center sm:flex-row gap-6">
                                <FormField control={form.control} name="avatar" render={({ field }) => (
                                    <FormItem className="flex flex-col items-center space-y-2 flex-shrink-0">
                                        <Avatar className="h-24 w-24">
                                            <AvatarImage src={currentAvatarUrl} alt={form.getValues('name') || 'Avatar'} key={currentAvatarUrl} />
                                            <AvatarFallback>{form.getValues('name')?.slice(0, 2).toUpperCase() || '??'}</AvatarFallback>
                                        </Avatar>
                                        <label htmlFor="avatar-upload" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                                            <Upload className="mr-2 h-4 w-4" /> Alterar foto
                                            <FormControl>
                                                <Input
                                                    id="avatar-upload"
                                                    type="file"
                                                    className="hidden"
                                                    accept={ACCEPTED_AVATAR_TYPES.join(',')}
                                                    ref={field.ref}
                                                    name={field.name}
                                                    onBlur={field.onBlur}
                                                    onChange={onFileChange}
                                                    disabled={isSubmitting}
                                                />
                                            </FormControl>
                                        </label>
                                        {selectedAvatarName && (
                                            <div className='flex items-center text-xs text-muted-foreground gap-1'>
                                                <span className="truncate max-w-[150px]" title={selectedAvatarName}>{selectedAvatarName}</span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type='button' variant='ghost' size='icon' className='h-5 w-5 text-destructive hover:bg-destructive/10' onClick={onFileRemove} disabled={isSubmitting}>
                                                            <Trash2 className='h-3 w-3' />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right"><p>Remover seleção</p></TooltipContent>
                                                </Tooltip>
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="flex-1 space-y-4 w-full">
                                    <FormField control={form.control} name="name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nome</FormLabel>
                                            <FormControl><Input {...field} value={field.value ?? ''} disabled={isSubmitting} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl><Input type="email" {...field} value={field.value ?? ''} disabled={true} readOnly className="cursor-not-allowed bg-muted/50" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button type="submit" disabled={isSubmitting || isLoading || !form.formState.isDirty}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Perfil
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </TooltipProvider>
        </FormProvider>
    );
}