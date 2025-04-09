// components/configuracoes/profile-settings-form.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSettings } from '@/hooks/useSettings';
import { Loader2, Upload, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';

// Schema for profile form validation - Focus only on editable fields
const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  // ***** CORREÇÃO AQUI *****
  // Substituir z.instanceof(File) por z.any()
  // Mover a validação de tipo/tamanho para refine com verificação
  avatar: z.any()
    .optional().nullable()
    // Validar tamanho SOMENTE se for um objeto com 'size' (seguro no server)
    .refine(file => !file || (typeof file === 'object' && typeof file.size === 'number' && file.size <= 5 * 1024 * 1024), `Avatar excede 5MB.`)
    // Validar tipo SOMENTE se for um objeto com 'type' (seguro no server)
    .refine(file => !file || (typeof file === 'object' && typeof file.type === 'string' && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)), `Tipo de avatar inválido.`),
    // ***** FIM DA CORREÇÃO *****
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfileSettingsForm() {
  const { toast } = useToast();
  const { update: updateSession } = useSession();

  const {
    profileSettingsQuery,
    updateProfileMutation,
  } = useSettings();

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = profileSettingsQuery;
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      avatar: null,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name || '',
        avatar: null,
      });
      setAvatarPreview(profile.avatarUrl || null);
      setSelectedFileName(null);
    }
  }, [profile, form]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    form.setValue('avatar', file, { shouldValidate: true, shouldDirty: true });

    // A validação do Zod ocorrerá aqui. Se passar:
    setTimeout(() => { // Timeout para garantir que a validação do RHF ocorra
        const fieldState = form.getFieldState('avatar');
        if (file && !fieldState.error) {
          setSelectedFileName(file.name);
          const reader = new FileReader();
          reader.onloadend = () => { setAvatarPreview(reader.result as string); };
          reader.readAsDataURL(file);
        } else {
          // Se inválido ou sem arquivo, reverte preview e limpa estado
          setSelectedFileName(null);
          setAvatarPreview(profile?.avatarUrl || null);
          if (!file) form.setValue('avatar', null); // Garante limpar RHF se nenhum arquivo
          // O erro de validação será mostrado pelo FormMessage
          // Opcional: mostrar toast se a validação falhar aqui
          // if (fieldState.error) {
          //   toast({ variant: "destructive", title: "Erro", description: fieldState.error.message });
          // }
        }
    }, 50); // Pequeno delay
  };

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      let dataToSend: FormData | { name: string; avatarUrl?: string | null }; // Pode ser FormData ou JSON
      const avatarFile = values.avatar; // Obter o valor do formulário

      // **Validação Client-Side Adicional (Boa Prática)**
      // Verifica se é realmente um File antes de usar FormData
      if (avatarFile && typeof window !== 'undefined' && avatarFile instanceof File) {
        dataToSend = new FormData();
        dataToSend.append('name', values.name);
        dataToSend.append('avatar', avatarFile); // Só adiciona se for File
        console.log("[ProfileSubmit] Enviando FormData com novo avatar.");
      } else {
        // Se não for um File (ou for null/undefined), envia JSON
        dataToSend = { name: values.name };
        // Se `avatarFile` for null ou undefined explicitamente (pode significar remoção)
        // Você pode adicionar lógica para enviar `avatarUrl: null` se necessário
        if (values.avatar === null) {
             // Assumindo que a mutação tRPC entende `avatarUrl: null` como remoção
             (dataToSend as { name: string; avatarUrl?: string | null }).avatarUrl = null;
             console.log("[ProfileSubmit] Enviando JSON com avatarUrl: null para remoção.");
        } else {
            console.log("[ProfileSubmit] Enviando JSON (sem alteração de avatar ou não é instância de File).");
        }
      }

      // A mutação tRPC precisa ser capaz de lidar com FormData ou JSON
      const result = await updateProfileMutation.mutateAsync(dataToSend as any); // Cast `any` é necessário aqui

      if(result?.user) {
        await updateSession({ name: result.user.name, image: result.user.avatarUrl }); // 'image' é o campo padrão do NextAuth
         setAvatarPreview(result.user.avatarUrl || null);
         form.reset({ name: result.user.name || values.name, avatar: null }, { keepDirty: false });
         setSelectedFileName(null);
      } else {
         await updateSession();
         form.reset(values, { keepDirty: false });
         form.setValue('avatar', null);
         setSelectedFileName(null);
      }
      // Toast de sucesso é tratado no hook useSettings
    } catch (error: any) {
      console.error('Erro no onSubmit do formulário:', error);
      // Toast de erro é tratado no hook useSettings
    }
  };

  const isProcessing = updateProfileMutation.isPending;

  // --- Renderização (sem alterações significativas, exceto no file input) ---
  if (isLoadingProfile) { /* ... Skeleton ... */
        return ( <div className="space-y-6 animate-pulse"> <div><Skeleton className="h-8 w-32 mb-1" /><Skeleton className="h-4 w-48" /></div> <FormProvider {...form}><form className="space-y-6"> <div className="flex flex-col items-center space-y-4"> <Skeleton className="w-24 h-24 rounded-full" /> <Skeleton className="h-9 w-36 rounded-md" /> </div> <div className="space-y-4"> <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div> <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full" /></div> </div> <div className="flex justify-end"><Skeleton className="h-10 w-24 rounded-md" /></div> </form></FormProvider> </div> );
  }
  if (profileError) { /* ... Error Message ... */
        return <div className="text-red-600 p-4 border border-red-200 rounded-md bg-red-50">Erro ao carregar perfil: {profileError.message}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div> <h3 className="text-lg font-medium">Perfil</h3> <p className="text-sm text-muted-foreground">Atualize suas informações pessoais.</p> </div>
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Avatar Section */}
            <FormField
              control={form.control}
              name="avatar" // Mantém o nome do campo
              render={({ fieldState }) => (
                <FormItem className="flex flex-col items-center space-y-3">
                  <Avatar className="w-24 h-24 border">
                    <AvatarImage src={avatarPreview || undefined} alt={profile?.name || "Avatar"} />
                    <AvatarFallback> {profile?.name ? profile.name.charAt(0).toUpperCase() : <UserIcon />} </AvatarFallback>
                  </Avatar>
                  <FormControl>
                     <label htmlFor="avatar-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
                      <Upload className="mr-2 h-4 w-4" /> Alterar Foto
                      {/* Input continua igual, o `onChange` e `form.setValue` cuidam dele */}
                      <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={isProcessing} />
                    </label>
                  </FormControl>
                   {selectedFileName && !fieldState.error && ( <p className="text-xs text-muted-foreground">Novo: {selectedFileName}</p> )}
                  <FormMessage /> {/* Mostra erros de validação Zod */}
                </FormItem>
              )}
            />
            {/* Name Field (sem alterações) */}
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Nome</FormLabel> <FormControl><Input {...field} disabled={isProcessing} /></FormControl> <FormMessage /> </FormItem> )} />
            {/* Email Field (Read-only - sem alterações) */}
            <FormItem> <FormLabel>Email</FormLabel> <FormControl><Input value={profile?.email || ''} disabled type="email" readOnly className="bg-muted/50 cursor-not-allowed" /></FormControl> </FormItem>
            {/* Submit Button (sem alterações) */}
            <div className="flex justify-end"> <Button type="submit" disabled={isProcessing || !form.formState.isDirty}> {isProcessing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>) : "Salvar Alterações"} </Button> </div>
          </form>
        </Form>
      </FormProvider>
    </motion.div>
  );
}