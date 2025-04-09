// hooks/useRelatorios.ts
import { trpc } from '@/lib/trpc/client';
import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay, isValid } from 'date-fns';
import { skipToken } from '@tanstack/react-query';
import { exportarRelatorioSchema, RelatorioFilterInput } from '@/server/api/schemas/relatorios';

const defaultEndDate = endOfDay(new Date());
const defaultStartDate = startOfDay(subDays(defaultEndDate, 29));

export function useRelatorios(activeTab: string = 'categorias') {
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: defaultStartDate,
    to: defaultEndDate,
  });
  const [empreendimentoId, setEmpreendimentoId] = useState<string>('todos');

  const queryInput = useMemo<RelatorioFilterInput | typeof skipToken>(() => {
    if (!dateRange?.from || !dateRange?.to || !isValid(dateRange.from) || !isValid(dateRange.to)) {
      return skipToken;
    }
    return {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      empreendimentoId: empreendimentoId !== 'todos' ? empreendimentoId : undefined,
    };
  }, [dateRange, empreendimentoId]);

  const enabled = queryInput !== skipToken;

  // Queries
  const despesasPorCategoriaQuery = trpc.relatorios.getDespesasPorCategoria.useQuery(queryInput, { enabled: enabled && ['dashboard', 'categorias'].includes(activeTab) });
  const despesasPorTempoQuery = trpc.relatorios.getDespesasPorMes.useQuery(queryInput, { enabled: enabled && ['dashboard', 'despesas', 'tendencias'].includes(activeTab) });
  const kpisQuery = trpc.relatorios.getKpis.useQuery(queryInput, { enabled: enabled && activeTab === 'dashboard' });
  const orcamentoQuery = trpc.relatorios.getOrcamento.useQuery({ empreendimentoId }, { enabled: enabled && activeTab === 'dashboard' });
  const tendenciasQuery = trpc.relatorios.getTendencia.useQuery(queryInput, { enabled: enabled && ['dashboard', 'tendencias'].includes(activeTab) });
  const comparativoQuery = trpc.relatorios.getComparativoPeriodo.useQuery(queryInput, { enabled: enabled && activeTab === 'comparativo' });

  // Estado para controlar exportação
  const [isExportando, setIsExportando] = useState(false);

  return {
    kpis: kpisQuery.data,
    orcamento: orcamentoQuery.data,
    tendencias: tendenciasQuery.data,
    despesasPorCategoria: despesasPorCategoriaQuery.data,
    despesasPorTempo: despesasPorTempoQuery.data,
    comparativoPeriodo: comparativoQuery.data,

    isLoading: !enabled,
    isLoadingCategorias: despesasPorCategoriaQuery.isLoading,
    isLoadingTempo: despesasPorTempoQuery.isLoading,
    isExportando,

    dateRange,
    empreendimentoId,

    updateDateRange: setDateRange,
    updateEmpreendimento: setEmpreendimentoId,

    exportarRelatorio: async (tipo: 'excel' | 'pdf', opcoes?: any) => {
      if (queryInput === skipToken) {
        toast({ title: "Selecione datas válidas" });
        return;
      }

      const parsed = exportarRelatorioSchema.safeParse({
        tipo,
        filtros: queryInput,
        opcoes,
      });

      if (!parsed.success) {
        toast({ title: "Erro nos filtros" });
        return;
      }

      setIsExportando(true);

      try {
        const mutation = trpc.relatorios.exportarRelatorio.useMutation({
          onSuccess: (data) => {
            if (data.downloadUrl) window.open(data.downloadUrl, '_blank');
            toast({ title: data.message });
          },
          onError: (error) => toast({ title: error.message, variant: "destructive" }),
        });

        await mutation.mutateAsync(parsed.data);
      } catch (error) {
        toast({ 
          title: "Erro ao exportar relatório", 
          variant: "destructive" 
        });
      } finally {
        setIsExportando(false);
      }
    },
  };
}
