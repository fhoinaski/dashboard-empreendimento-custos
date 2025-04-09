import { trpc } from '@/lib/trpc/client';
import { useCallback, useEffect } from 'react'; // Import useEffect
import { useToast } from '@/components/ui/use-toast';
import type {
    UpdateProfileInput,
    ChangePasswordInput,
    UpdateCompanySettingsInput,
    UpdateNotificationSettingsInput,
    UpdateApiKeysInput,
    CreateApiKeyInput, // Assuming these are defined if used
    RevokeApiKeyInput, // Assuming these are defined if used
} from '@/server/api/schemas/settings'; // Adjust path if your schemas are here
import { TRPCClientErrorLike } from '@trpc/client'; // Import error type
import { AppRouter } from '@/server/api/root'; // Import AppRouter type

// Define ClientUser type if not imported elsewhere
interface ClientUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  // Add other fields as returned by your API
}

export function useSettings() {
  const { toast } = useToast();
  const utils = trpc.useContext(); // Get tRPC context for invalidation

  // --- Consultas ---
  // FIX 1, 2, 3, 4, 5: Remove onError from useQuery options
  const profileSettingsQuery = trpc.settings.getProfileSettings.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const companySettingsQuery = trpc.settings.getCompanySettings.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const notificationSettingsQuery = trpc.settings.getNotificationSettings.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const apiKeysQuery = trpc.settings.getApiKeys.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const usersQuery = trpc.users.getAll.useQuery(
    { limit: 100 }, // Fetch a larger list for settings page, adjust as needed
    {
      staleTime: 1000 * 60 * 5, // 5 minutos
    }
  );

  // --- Effect to show toast on query errors (optional, better handled in component) ---
  useEffect(() => {
    if (profileSettingsQuery.error) {
        console.error("Error fetching profile settings:", profileSettingsQuery.error);
        toast({ title: "Erro Perfil", description: `Falha: ${profileSettingsQuery.error.message}`, variant: "destructive" });
    }
  }, [profileSettingsQuery.error, toast]);

  useEffect(() => {
    if (companySettingsQuery.error) {
        console.error("Error fetching company settings:", companySettingsQuery.error);
        toast({ title: "Erro Empresa", description: `Falha: ${companySettingsQuery.error.message}`, variant: "destructive" });
    }
  }, [companySettingsQuery.error, toast]);

    useEffect(() => {
    if (notificationSettingsQuery.error) {
        console.error("Error fetching notification settings:", notificationSettingsQuery.error);
        toast({ title: "Erro Notificações", description: `Falha: ${notificationSettingsQuery.error.message}`, variant: "destructive" });
    }
    }, [notificationSettingsQuery.error, toast]);

    useEffect(() => {
    if (apiKeysQuery.error) {
        console.error("Error fetching API keys:", apiKeysQuery.error);
        toast({ title: "Erro Chaves API", description: `Falha: ${apiKeysQuery.error.message}`, variant: "destructive" });
    }
    }, [apiKeysQuery.error, toast]);

    useEffect(() => {
    if (usersQuery.error) {
        console.error("Error fetching users:", usersQuery.error);
        toast({ title: "Erro Usuários", description: `Falha: ${usersQuery.error.message}`, variant: "destructive" });
    }
    }, [usersQuery.error, toast]);
  // --- End Error Effects ---


  // --- Mutações (onError remains valid here) ---
  const updateProfileMutation = trpc.settings.updateProfile.useMutation({
    onSuccess: (data) => {
      toast({ title: "Perfil atualizado", description: "Seu perfil foi atualizado com sucesso." });
      utils.settings.getProfileSettings.invalidate();
      return data;
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
      toast({ title: "Erro ao atualizar perfil", description: error.message, variant: "destructive" });
    },
  });

  const updateCompanyMutation = trpc.settings.updateCompanySettings.useMutation({
    onSuccess: () => {
      toast({ title: "Empresa atualizada", description: "As informações da empresa foram atualizadas com sucesso." });
      utils.settings.getCompanySettings.invalidate();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
    },
  });

  const updateNotificationSettingsMutation = trpc.settings.updateNotificationSettings.useMutation({
    onSuccess: () => {
      toast({ title: "Configurações de notificação atualizadas", description: "Suas preferências de notificação foram atualizadas." });
      utils.settings.getNotificationSettings.invalidate();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
      toast({ title: "Erro ao atualizar notificações", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = trpc.settings.updatePassword.useMutation({
    onSuccess: () => {
      toast({ title: "Senha alterada", description: "Sua senha foi alterada com sucesso." });
      // No query to invalidate usually, maybe refetch profile if needed
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    },
  });

  const updateApiKeysMutation = trpc.settings.updateApiKeys.useMutation({
     onSuccess: () => {
       toast({ title: "Chaves API atualizadas", description: "As chaves foram atualizadas." });
       utils.settings.getApiKeys.invalidate();
     },
     onError: (error: TRPCClientErrorLike<AppRouter>) => { // Type the error
       toast({ title: "Erro ao atualizar Chaves API", description: error.message, variant: "destructive" });
     },
   });

   // Example placeholders (replace with actual calls if implemented)
   // Assuming these mutations exist and handle their own errors/success messages
   const createApiKeyMutation = trpc.settings.createApiKey.useMutation({
       onSuccess: () => { utils.settings.getApiKeys.invalidate(); }, // Example invalidation
       onError: (error: TRPCClientErrorLike<AppRouter>) => { /* Handle error */ }
   });
   const revokeApiKeyMutation = trpc.settings.revokeApiKey.useMutation({
       onSuccess: () => { utils.settings.getApiKeys.invalidate(); }, // Example invalidation
       onError: (error: TRPCClientErrorLike<AppRouter>) => { /* Handle error */ }
   });


  // --- Funções de Ação (Wrappers around mutations) ---
  // Update signature to match expected input if different from FormData
  const updateProfile = useCallback(async (data: UpdateProfileInput) => {
    // Assuming the mutation expects UpdateProfileInput directly now
    return updateProfileMutation.mutateAsync(data);
  }, [updateProfileMutation]);


  const updateCompany = useCallback(async (data: UpdateCompanySettingsInput) => {
    return updateCompanyMutation.mutateAsync(data);
  }, [updateCompanyMutation]);

  const updateNotificationSettings = useCallback(async (data: UpdateNotificationSettingsInput) => {
    return updateNotificationSettingsMutation.mutateAsync(data);
  }, [updateNotificationSettingsMutation]);

  const changePassword = useCallback(async (data: ChangePasswordInput) => {
    return changePasswordMutation.mutateAsync(data);
  }, [changePasswordMutation]);

   const updateApiKeys = useCallback(async (data: UpdateApiKeysInput) => {
      return updateApiKeysMutation.mutateAsync(data);
   }, [updateApiKeysMutation]);

   const createApiKey = useCallback(async (data: CreateApiKeyInput) => { // Use correct input type
     return createApiKeyMutation.mutateAsync(data);
   }, [createApiKeyMutation]);

   const revokeApiKey = useCallback(async (id: string) => {
     return revokeApiKeyMutation.mutateAsync({ id }); // Ensure input matches mutation
   }, [revokeApiKeyMutation]);


  return {
    // Query objects (contain data, isLoading, error, etc.)
    profileSettingsQuery,
    companySettingsQuery,
    notificationSettingsQuery,
    apiKeysQuery,
    usersQuery,

    // Specific loading states for convenience
    isProfileLoading: profileSettingsQuery.isLoading,
    isCompanyLoading: companySettingsQuery.isLoading,
    isNotificationSettingsLoading: notificationSettingsQuery.isLoading,
    isApiKeysLoading: apiKeysQuery.isLoading,
    isUsersLoading: usersQuery.isLoading,

    // Mutation objects (contain mutate, mutateAsync, isPending, error, etc.)
    updateProfileMutation,
    updateCompanyMutation,
    updateNotificationSettingsMutation,
    changePasswordMutation,
    updateApiKeysMutation,
    createApiKeyMutation,
    revokeApiKeyMutation,

    // Action wrappers (optional convenience)
    updateProfile,
    updateCompany,
    updateNotificationSettings,
    changePassword,
    updateApiKeys,
    createApiKey,
    revokeApiKey,
  };
}