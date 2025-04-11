// FILE: hooks/useSettings.ts (Refatorado Completo)
// ============================================================
import { trpc } from '@/lib/trpc/client';
import { useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type {
    ChangePasswordInput,
    CreateApiKeyInput,
    RevokeApiKeyInput,
    UpdateApiKeysInput,
    UpdateCompanySettingsInput,
    UpdateNotificationSettingsInput,
    UpdateProfileInput,
    UpdateTenantIntegrationSettingsInput,
} from '@/server/api/schemas/settings';
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '@/server/api/root';

export function useSettings() {
    const { toast } = useToast();
    const utils = trpc.useContext();

    // --- Consultas ---
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
        { limit: 100 },
        {
            staleTime: 1000 * 60 * 5, // 5 minutos
        }
    );

    const getTenantIntegrationSettings = trpc.settings.getTenantIntegrationSettings.useQuery(undefined, {
        staleTime: 1000 * 60 * 5, // 5 minutos
    });

    // --- Efeitos para Tratamento de Erros das Consultas ---
    useEffect(() => {
        if (profileSettingsQuery.error) {
            console.error('Erro ao buscar configurações de perfil:', profileSettingsQuery.error);
            toast({
                title: 'Erro Perfil',
                description: `Falha: ${profileSettingsQuery.error.message}`,
                variant: 'destructive',
            });
        }
    }, [profileSettingsQuery.error, toast]);

    useEffect(() => {
        if (companySettingsQuery.error) {
            console.error('Erro ao buscar configurações da empresa:', companySettingsQuery.error);
            toast({
                title: 'Erro Empresa',
                description: `Falha: ${companySettingsQuery.error.message}`,
                variant: 'destructive',
            });
        }
    }, [companySettingsQuery.error, toast]);

    useEffect(() => {
        if (notificationSettingsQuery.error) {
            console.error('Erro ao buscar configurações de notificação:', notificationSettingsQuery.error);
            toast({
                title: 'Erro Notificações',
                description: `Falha: ${notificationSettingsQuery.error.message}`,
                variant: 'destructive',
            });
        }
    }, [notificationSettingsQuery.error, toast]);

    useEffect(() => {
        if (apiKeysQuery.error) {
            console.error('Erro ao buscar chaves API:', apiKeysQuery.error);
            toast({
                title: 'Erro Chaves API',
                description: `Falha: ${apiKeysQuery.error.message}`,
                variant: 'destructive',
            });
        }
    }, [apiKeysQuery.error, toast]);

    useEffect(() => {
        if (usersQuery.error) {
            console.error('Erro ao buscar usuários:', usersQuery.error);
            toast({
                title: 'Erro Usuários',
                description: `Falha: ${usersQuery.error.message}`,
                variant: 'destructive',
            });
        }
    }, [usersQuery.error, toast]);

    useEffect(() => {
        if (getTenantIntegrationSettings.error) {
            console.error('Erro ao buscar configurações de integração do tenant:', getTenantIntegrationSettings.error);
            toast({
                title: 'Erro Integrações',
                description: `Falha: ${getTenantIntegrationSettings.error.message}`,
                variant: 'destructive',
            });
        }
    }, [getTenantIntegrationSettings.error, toast]);

    // --- Mutações ---
    const updateProfileMutation = trpc.settings.updateProfile.useMutation({
        onSuccess: (data) => {
            toast({
                title: 'Perfil Atualizado',
                description: 'Seu perfil foi atualizado com sucesso.',
            });
            utils.settings.getProfileSettings.invalidate();
            return data;
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Atualizar Perfil',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const updateCompanyMutation = trpc.settings.updateCompanySettings.useMutation({
        onSuccess: () => {
            toast({
                title: 'Empresa Atualizada',
                description: 'As informações da empresa foram atualizadas com sucesso.',
            });
            utils.settings.getCompanySettings.invalidate();
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Atualizar Empresa',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const updateNotificationSettingsMutation = trpc.settings.updateNotificationSettings.useMutation({
        onSuccess: () => {
            toast({
                title: 'Notificações Atualizadas',
                description: 'Suas preferências de notificação foram atualizadas.',
            });
            utils.settings.getNotificationSettings.invalidate();
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Atualizar Notificações',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const changePasswordMutation = trpc.settings.updatePassword.useMutation({
        onSuccess: () => {
            toast({
                title: 'Senha Alterada',
                description: 'Sua senha foi alterada com sucesso.',
            });
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Alterar Senha',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const updateApiKeysMutation = trpc.settings.updateApiKeys.useMutation({
        onSuccess: () => {
            toast({
                title: 'Chaves API Atualizadas',
                description: 'As chaves foram atualizadas.',
            });
            utils.settings.getApiKeys.invalidate();
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Atualizar Chaves API',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const createApiKeyMutation = trpc.settings.createApiKey.useMutation({
        onSuccess: (data) => {
            toast({
                title: 'Chave API Criada',
                description: 'Uma nova chave API foi criada com sucesso.',
            });
            utils.settings.getApiKeys.invalidate();
            return data;
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Criar Chave API',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const revokeApiKeyMutation = trpc.settings.revokeApiKey.useMutation({
        onSuccess: () => {
            toast({
                title: 'Chave API Revogada',
                description: 'A chave API foi revogada com sucesso.',
            });
            utils.settings.getApiKeys.invalidate();
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Revogar Chave API',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    const updateTenantIntegrationSettingsMutation = trpc.settings.updateTenantIntegrationSettings.useMutation({
        onSuccess: () => {
            toast({
                title: 'Integrações Atualizadas',
                description: 'Configurações Google salvas.',
            });
            utils.settings.getTenantIntegrationSettings.invalidate();
        },
        onError: (error: TRPCClientErrorLike<AppRouter>) => {
            toast({
                title: 'Erro ao Salvar Integrações',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // --- Funções de Ação (Wrappers) ---
    const updateProfile = useCallback(
        async (data: UpdateProfileInput) => updateProfileMutation.mutateAsync(data),
        [updateProfileMutation]
    );

    const updateCompany = useCallback(
        async (data: UpdateCompanySettingsInput) => updateCompanyMutation.mutateAsync(data),
        [updateCompanyMutation]
    );

    const updateNotificationSettings = useCallback(
        async (data: UpdateNotificationSettingsInput) => updateNotificationSettingsMutation.mutateAsync(data),
        [updateNotificationSettingsMutation]
    );

    const changePassword = useCallback(
        async (data: ChangePasswordInput) => changePasswordMutation.mutateAsync(data),
        [changePasswordMutation]
    );

    const updateApiKeys = useCallback(
        async (data: UpdateApiKeysInput) => updateApiKeysMutation.mutateAsync(data),
        [updateApiKeysMutation]
    );

    const createApiKey = useCallback(
        async (data: CreateApiKeyInput) => createApiKeyMutation.mutateAsync(data),
        [createApiKeyMutation]
    );

    const revokeApiKey = useCallback(
        async (id: string) => revokeApiKeyMutation.mutateAsync({ id }),
        [revokeApiKeyMutation]
    );

    const updateTenantIntegrationSettings = useCallback(
        async (data: UpdateTenantIntegrationSettingsInput) => updateTenantIntegrationSettingsMutation.mutateAsync(data),
        [updateTenantIntegrationSettingsMutation]
    );

    return {
        // Consultas
        profileSettingsQuery,
        companySettingsQuery,
        notificationSettingsQuery,
        apiKeysQuery,
        usersQuery,
        getTenantIntegrationSettings,

        // Estados de Carregamento
        isProfileLoading: profileSettingsQuery.isLoading,
        isCompanyLoading: companySettingsQuery.isLoading,
        isNotificationSettingsLoading: notificationSettingsQuery.isLoading,
        isApiKeysLoading: apiKeysQuery.isLoading,
        isUsersLoading: usersQuery.isLoading,
        isTenantIntegrationSettingsLoading: getTenantIntegrationSettings.isLoading,

        // Mutações
        updateProfileMutation,
        updateCompanyMutation,
        updateNotificationSettingsMutation,
        changePasswordMutation,
        updateApiKeysMutation,
        createApiKeyMutation,
        revokeApiKeyMutation,
        updateTenantIntegrationSettingsMutation,

        // Ações
        updateProfile,
        updateCompany,
        updateNotificationSettings,
        changePassword,
        updateApiKeys,
        createApiKey,
        revokeApiKey,
        updateTenantIntegrationSettings,
    };
}
// ============================================================
// FIM DO ARQUIVO REFACTORADO: hooks/useSettings.ts
// ============================================================