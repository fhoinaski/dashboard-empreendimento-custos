
import { useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
// *** CORREÇÃO AQUI: Importar o tipo correto ***
import type { DynamicUIConfigResponse, DynamicUIConfigFieldInput } from '@/server/api/schemas/uiConfig'; // Importar tipos da resposta e do field

// Estrutura de retorno do hook
interface UseUiConfigReturn {
    config: DynamicUIConfigResponse | null; // Retorna a config completa ou null
    isLoading: boolean;
    error: unknown; // Erro da query tRPC
    getLabel: (originalLabel: string, fallbackLabel?: string) => string;
    // *** CORREÇÃO AQUI: Usar o tipo correto ***
    getFieldConfig: (fieldName: string) => DynamicUIConfigFieldInput | undefined;
    // *** CORREÇÃO AQUI: Usar o tipo correto ***
    getVisibleFields: (context?: 'form' | 'table' | 'detail') => DynamicUIConfigFieldInput[];
    refetch: () => void; // Função para rebuscar
}

// --- Default Field Configurations (Opcional) ---
// A estrutura interna permanece a mesma, apenas o tipo de 'fields' precisa corresponder
const defaultFieldsBase: Record<string, DynamicUIConfigFieldInput[]> = {
    despesas: [
        { fieldName: 'description', label: 'Descrição', required: true, visible: true, order: 1 },
        { fieldName: 'value', label: 'Valor (R$)', required: true, visible: true, order: 2 },
        { fieldName: 'dueDate', label: 'Vencimento', required: true, visible: true, order: 3 },
        // ... outros campos base ...
    ],
    empreendimentos: [
         { fieldName: 'name', label: 'Nome', required: true, visible: true, order: 1 },
         { fieldName: 'address', label: 'Endereço', required: true, visible: true, order: 2 },
         // ... outros campos base ...
    ]
};

export function useUiConfig(module: string | undefined | null): UseUiConfigReturn {
    const { data: configData, isLoading, error, refetch, isError } = trpc.uiConfig.getUiConfig.useQuery(
        { module: module! },
        {
            enabled: !!module,
            staleTime: 1000 * 60 * 15,
            refetchOnWindowFocus: false,
            retry: (failureCount, err: any) => {
                if (err?.data?.code === 'NOT_FOUND') return false;
                return failureCount < 3;
            }
        }
    );

    const config = useMemo(() => {
        if (isLoading || (isError && error?.data?.code !== 'NOT_FOUND')) {
            return null;
        }
        if (configData) {
             // A ordenação continua válida, pois 'order' existe em DynamicUIConfigFieldInput
            const sortedFields = [...(configData.fields || [])].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
            return { ...configData, fields: sortedFields };
        }
        return null;
    }, [configData, isLoading, isError, error]);

    // --- Helper Functions ---
    const getLabel = useCallback((originalLabel: string, fallbackLabel?: string): string => {
        return config?.labels?.[originalLabel] || fallbackLabel || originalLabel;
    }, [config?.labels]);

    // *** CORREÇÃO AQUI: Tipo de retorno atualizado ***
    const getFieldConfig = useCallback((fieldName: string): DynamicUIConfigFieldInput | undefined => {
        return config?.fields?.find(f => f.fieldName === fieldName);
    }, [config?.fields]);

    // *** CORREÇÃO AQUI: Tipo de retorno atualizado ***
    const getVisibleFields = useCallback((context?: 'form' | 'table' | 'detail'): DynamicUIConfigFieldInput[] => {
        if (!config?.fields) return [];
        return config.fields.filter(f => f.visible);
    }, [config?.fields]);

    return {
        config,
        isLoading,
        error,
        getLabel,
        getFieldConfig,
        getVisibleFields,
        refetch,
    };
}
