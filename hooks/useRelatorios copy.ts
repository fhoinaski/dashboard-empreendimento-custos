// hooks/useRelatorios.ts
import { trpc } from '@/lib/trpc/client';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { skipToken } from '@tanstack/react-query';
// Importar tipos de output dos schemas de relatórios
import type {
    KpiOutput,
    OrcamentoOutput,
    TendenciasOutput,
    DespesasPorCategoriaOutput,
    DespesasPorMesOutput,
    ComparativoPeriodoOutput,
    ExportarRelatorioInput,
    ExportarRelatorioResponse,
    RelatorioFilterInput
} from '@/server/api/schemas/relatorios';
import { exportarRelatorioSchema } from '@/server/api/schemas/relatorios';

// Default date range (last 30 days)
const defaultEndDate = endOfDay(new Date());
const defaultStartDate = startOfDay(subDays(defaultEndDate, 29));

export function useRelatorios() {
    const { toast } = useToast();
    const utils = trpc.useContext();

    // --- State for Filters ---
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: defaultStartDate,
        to: defaultEndDate,
    });
    const [empreendimentoId, setEmpreendimentoId] = useState<string | undefined>(undefined); // undefined means 'todos'
    const [periodoComparativo, setPeriodoComparativo] = useState<string>("mes");

    // --- Input object for tRPC queries based on current filters ---
    const queryInput = useMemo((): RelatorioFilterInput | typeof skipToken => {
        const from = dateRange?.from;
        const to = dateRange?.to;
        if (!from || !to || !isValid(from) || !isValid(to)) {
            return skipToken;
        }
        return {
            startDate: from.toISOString(),
            endDate: to.toISOString(),
            empreendimentoId: empreendimentoId,
        };
    }, [dateRange, empreendimentoId]);

    // --- tRPC Queries using the new relatoriosRouter ---
    const kpiQuery = trpc.relatorios.getKpis.useQuery(queryInput, { enabled: queryInput !== skipToken });
    const orcamentoQuery = trpc.relatorios.getOrcamento.useQuery({ empreendimentoId }, { enabled: queryInput !== skipToken }); // Enable based on queryInput validity too
    const tendenciasQuery = trpc.relatorios.getTendencia.useQuery(queryInput, { enabled: queryInput !== skipToken });
    const despesasPorCategoriaQuery = trpc.relatorios.getDespesasPorCategoria.useQuery(queryInput, { enabled: queryInput !== skipToken });
    const despesasPorTempoQuery = trpc.relatorios.getDespesasPorMes.useQuery(queryInput, { enabled: queryInput !== skipToken });
    const comparativoPeriodoQuery = trpc.relatorios.getComparativoPeriodo.useQuery(queryInput, { enabled: queryInput !== skipToken });

    // --- tRPC Mutation for Export ---
    const exportarRelatorioMutation = trpc.relatorios.exportarRelatorio.useMutation({
        onSuccess: (data: ExportarRelatorioResponse) => {
            if (data.success && data.downloadUrl) {
                window.open(data.downloadUrl, '_blank');
                toast({ title: "Download Iniciado", description: data.message });
            } else if (data.success) {
                toast({ title: "Exportação Iniciada", description: data.message });
            } else {
                throw new Error(data.message || "Falha na exportação");
            }
        },
        onError: (error: any) => {
            toast({ variant: "destructive", title: "Erro ao Exportar", description: error.message });
        },
    });

    // --- Callback Functions to Update Filters ---
    const updateDateRange = useCallback((newDateRange: DateRange | undefined) => {
        setDateRange(newDateRange);
    }, []);

    const updateEmpreendimento = useCallback((id: string | undefined) => {
        setEmpreendimentoId(id === 'todos' ? undefined : id);
    }, []);

    const updatePeriodoComparativo = useCallback((periodo: string) => {
        setPeriodoComparativo(periodo);
        // utils.relatorios.getComparativoPeriodo.invalidate(); // Invalidate if needed
    }, []);

    // --- Export Function ---
    const exportarRelatorio = useCallback(async (tipo: 'excel' | 'pdf', opcoes?: any) => {
        if (queryInput === skipToken) {
            toast({ title: "Seleção Necessária", description: "Por favor, selecione um período válido.", variant: "default" });
            return;
        }
        const exportInputValidation = exportarRelatorioSchema.safeParse({
            tipo,
            filtros: queryInput, // Passa os filtros atuais
            opcoes: opcoes,
        });

        if (!exportInputValidation.success) {
            console.error("Erro de validação na exportação:", exportInputValidation.error);
            toast({ title: "Erro nos Filtros", description: "Verifique os filtros selecionados.", variant: "destructive" });
            return;
        }

        return exportarRelatorioMutation.mutateAsync(exportInputValidation.data);
    }, [exportarRelatorioMutation, queryInput, toast]);

    // --- Error Handling Effects (Optional) ---
    // useEffect(() => { if (kpiQuery.error) toast({ variant: "destructive", title: "Erro KPIs", description: kpiQuery.error.message }); }, [kpiQuery.error, toast]);
    // ... (outros useEffects de erro podem ser mantidos ou removidos) ...

    return {
        // Data from queries (com fallback para evitar undefined)
        kpis: kpiQuery.data,
        orcamento: orcamentoQuery.data,
        tendencias: tendenciasQuery.data,
        despesasPorCategoria: despesasPorCategoriaQuery.data,
        despesasPorTempo: despesasPorTempoQuery.data,
        comparativoPeriodo: comparativoPeriodoQuery.data,

        // Filters state
        dateRange,
        empreendimentoId: empreendimentoId ?? 'todos',
        periodoComparativo,

        // Loading states
        isLoadingKpis: kpiQuery.isLoading || kpiQuery.isFetching,
        isLoadingOrcamento: orcamentoQuery.isLoading || orcamentoQuery.isFetching,
        isLoadingTendencias: tendenciasQuery.isLoading || tendenciasQuery.isFetching,
        isLoadingCategorias: despesasPorCategoriaQuery.isLoading || despesasPorCategoriaQuery.isFetching,
        isLoadingTempo: despesasPorTempoQuery.isLoading || despesasPorTempoQuery.isFetching,
        isLoadingComparativo: comparativoPeriodoQuery.isLoading || comparativoPeriodoQuery.isFetching,
        isExportando: exportarRelatorioMutation.isPending,

        // Functions
        updateDateRange,
        updateEmpreendimento,
        updatePeriodoComparativo,
        exportarRelatorio,
    };
}