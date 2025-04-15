// FILE: hooks/useSettings.ts (Refatorado com 'enabled' nas queries)
// ============================================================
import { trpc } from '@/lib/trpc/client';
import { useCallback, useEffect, useMemo } from 'react'; // Adicionado useMemo
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react'; // Importar useSession
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
    const { data: session, status: sessionStatus } = useSession(); // Obter sessão e status

    // Determinar roles e tenant status baseado na sessão
    const userRole = useMemo(() => session?.user?.role, [session]);
    const userTenantId = useMemo(() => session?.user?.tenantId, [session]);
    const isSuperAdmin = useMemo(() => userRole === 'superadmin' && !userTenantId, [userRole, userTenantId]);
    const isTenantAdmin = useMemo(() => userRole === 'admin' && !!userTenantId, [userRole, userTenantId]);
    const isAuthenticated = useMemo(() => sessionStatus === 'authenticated', [sessionStatus]);

    // --- Consultas com 'enabled' baseado no role ---
    const profileSettingsQuery = trpc.settings.getProfileSettings.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        enabled: isAuthenticated, // Habilitado para qualquer usuário autenticado
    });

    const companySettingsQuery = trpc.settings.getCompanySettings.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        enabled: isSuperAdmin, // <<< Habilitado APENAS para Super Admin
    });

    const notificationSettingsQuery = trpc.settings.getNotificationSettings.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        enabled: isAuthenticated, // Habilitado para qualquer usuário autenticado
    });

    const apiKeysQuery = trpc.settings.getApiKeys.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        enabled: isSuperAdmin, // <<< Habilitado APENAS para Super Admin
    });

    // A query de usuários pode precisar ser movida para um hook específico se o filtro for mais complexo
    // Ou adicionar a lógica de tenant aqui se settings precisar dela (parece que não precisa mais)
    // const usersQuery = trpc.users.getAll.useQuery(...)

    const getTenantIntegrationSettings = trpc.settings.getTenantIntegrationSettings.useQuery(undefined, {
        staleTime: 1000 * 60 * 5,
        enabled: isTenantAdmin, // <<< Habilitado APENAS para Tenant Admin
    });

    // --- Efeitos para Tratamento de Erros das Consultas (Inalterados) ---
    useEffect(() => { if (profileSettingsQuery.error) { console.error('Erro Perfil:', profileSettingsQuery.error); toast({ title: 'Erro Perfil', description: `Falha: ${profileSettingsQuery.error.message}`, variant: 'destructive'}); } }, [profileSettingsQuery.error, toast]);
    useEffect(() => { if (companySettingsQuery.error) { console.error('Erro Empresa (Global):', companySettingsQuery.error); toast({ title: 'Erro Empresa', description: `Falha: ${companySettingsQuery.error.message}`, variant: 'destructive'}); } }, [companySettingsQuery.error, toast]);
    useEffect(() => { if (notificationSettingsQuery.error) { console.error('Erro Notificações:', notificationSettingsQuery.error); toast({ title: 'Erro Notificações', description: `Falha: ${notificationSettingsQuery.error.message}`, variant: 'destructive'}); } }, [notificationSettingsQuery.error, toast]);
    useEffect(() => { if (apiKeysQuery.error) { console.error('Erro Chaves API (Global):', apiKeysQuery.error); toast({ title: 'Erro Chaves API', description: `Falha: ${apiKeysQuery.error.message}`, variant: 'destructive'}); } }, [apiKeysQuery.error, toast]);
    // useEffect(() => { if (usersQuery.error) { console.error('Erro Usuários:', usersQuery.error); toast({ title: 'Erro Usuários', description: `Falha: ${usersQuery.error.message}`, variant: 'destructive'}); } }, [usersQuery.error, toast]);
    useEffect(() => { if (getTenantIntegrationSettings.error) { console.error('Erro Integrações Tenant:', getTenantIntegrationSettings.error); toast({ title: 'Erro Integrações', description: `Falha: ${getTenantIntegrationSettings.error.message}`, variant: 'destructive'}); } }, [getTenantIntegrationSettings.error, toast]);

    // --- Mutações (Inalteradas) ---
    const updateProfileMutation = trpc.settings.updateProfile.useMutation({ onSuccess: (data) => { toast({ title: 'Perfil Atualizado', description: 'Seu perfil foi atualizado.' }); utils.settings.getProfileSettings.invalidate(); return data; }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Atualizar Perfil', description: error.message, variant: 'destructive'}); }, });
    const updateCompanyMutation = trpc.settings.updateCompanySettings.useMutation({ onSuccess: () => { toast({ title: 'Empresa Atualizada', description: 'Informações da empresa atualizadas.' }); utils.settings.getCompanySettings.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Atualizar Empresa', description: error.message, variant: 'destructive'}); }, });
    const updateNotificationSettingsMutation = trpc.settings.updateNotificationSettings.useMutation({ onSuccess: () => { toast({ title: 'Notificações Atualizadas', description: 'Preferências atualizadas.' }); utils.settings.getNotificationSettings.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Atualizar Notificações', description: error.message, variant: 'destructive'}); }, });
    const changePasswordMutation = trpc.settings.updatePassword.useMutation({ onSuccess: () => { toast({ title: 'Senha Alterada', description: 'Sua senha foi alterada.' }); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Alterar Senha', description: error.message, variant: 'destructive'}); }, });
    const updateApiKeysMutation = trpc.settings.updateApiKeys.useMutation({ onSuccess: () => { toast({ title: 'Chaves API Atualizadas', description: 'As chaves foram atualizadas.' }); utils.settings.getApiKeys.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Atualizar Chaves API', description: error.message, variant: 'destructive'}); }, });
    const createApiKeyMutation = trpc.settings.createApiKey.useMutation({ onSuccess: (data) => { toast({ title: 'Chave API Criada' }); utils.settings.getApiKeys.invalidate(); return data; }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Criar Chave API', description: error.message, variant: 'destructive'}); }, });
    const revokeApiKeyMutation = trpc.settings.revokeApiKey.useMutation({ onSuccess: () => { toast({ title: 'Chave API Revogada' }); utils.settings.getApiKeys.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Revogar Chave API', description: error.message, variant: 'destructive'}); }, });
    const updateTenantIntegrationSettingsMutation = trpc.settings.updateTenantIntegrationSettings.useMutation({ onSuccess: () => { toast({ title: 'Integrações Atualizadas', description: 'Configurações Google salvas.' }); utils.settings.getTenantIntegrationSettings.invalidate(); }, onError: (error: TRPCClientErrorLike<AppRouter>) => { toast({ title: 'Erro ao Salvar Integrações', description: error.message, variant: 'destructive'}); }, });

    // --- Funções de Ação (Wrappers - Inalterados) ---
    const updateProfile = useCallback( async (data: UpdateProfileInput) => updateProfileMutation.mutateAsync(data), [updateProfileMutation] );
    const updateCompany = useCallback( async (data: UpdateCompanySettingsInput) => updateCompanyMutation.mutateAsync(data), [updateCompanyMutation] );
    const updateNotificationSettings = useCallback( async (data: UpdateNotificationSettingsInput) => updateNotificationSettingsMutation.mutateAsync(data), [updateNotificationSettingsMutation] );
    const changePassword = useCallback( async (data: ChangePasswordInput) => changePasswordMutation.mutateAsync(data), [changePasswordMutation] );
    const updateApiKeys = useCallback( async (data: UpdateApiKeysInput) => updateApiKeysMutation.mutateAsync(data), [updateApiKeysMutation] );
    const createApiKey = useCallback( async (data: CreateApiKeyInput) => createApiKeyMutation.mutateAsync(data), [createApiKeyMutation] );
    const revokeApiKey = useCallback( async (id: string) => revokeApiKeyMutation.mutateAsync({ id }), [revokeApiKeyMutation] );
    const updateTenantIntegrationSettings = useCallback( async (data: UpdateTenantIntegrationSettingsInput) => updateTenantIntegrationSettingsMutation.mutateAsync(data), [updateTenantIntegrationSettingsMutation] );

    return {
        // Consultas
        profileSettingsQuery,
        companySettingsQuery,
        notificationSettingsQuery,
        apiKeysQuery,
        // usersQuery, // Remover se não usado diretamente aqui
        getTenantIntegrationSettings,

        // Estados de Carregamento
        isLoading: sessionStatus === 'loading', // Estado de loading geral baseado na sessão
        isProfileLoading: profileSettingsQuery.isLoading || profileSettingsQuery.isFetching,
        isCompanyLoading: companySettingsQuery.isLoading || companySettingsQuery.isFetching,
        isNotificationSettingsLoading: notificationSettingsQuery.isLoading || notificationSettingsQuery.isFetching,
        isApiKeysLoading: apiKeysQuery.isLoading || apiKeysQuery.isFetching,
        // isUsersLoading: usersQuery.isLoading,
        isTenantIntegrationSettingsLoading: getTenantIntegrationSettings.isLoading || getTenantIntegrationSettings.isFetching,

        // Mutações (expor a mutation inteira permite acesso a isPending, etc.)
        updateProfileMutation,
        updateCompanyMutation,
        updateNotificationSettingsMutation,
        changePasswordMutation,
        updateApiKeysMutation,
        createApiKeyMutation,
        revokeApiKeyMutation,
        updateTenantIntegrationSettingsMutation,

        // Ações (Wrappers async)
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