import React, { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercent, formatVariation } from '@/utils/format';
import { useRelatorios } from '@/hooks/useRelatorios';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart } from './pie-chart';
import { BarChart } from './bar-chart';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmpreendimentoOption {
  _id: string;
  name: string;
}

interface PieChartDataPoint {
  name: string;
  value: number;
  color: string;
}

interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface PeriodoData {
  nome: string;
  valor: number;
}

interface DespesasPorCategoriaData {
  categorias: Record<string, number>;
  maiorCategoria: { nome: string; valor: number } | null;
}

interface DespesasPorTempoData {
  periodos: PeriodoData[];
  maiorPeriodo: { nome: string; valor: number } | null;
}

// Interface para o hook de relatórios
interface DateRangeHook {
  from: Date | undefined;
  to: Date | undefined;
}

export function ExpenseCategoryReport() {
  const {
    despesasPorCategoria,
    despesasPorTempo,
    dateRange,
    empreendimentoId,
    isLoadingCategorias,
    isLoadingTempo,
    isExportando,
    updateDateRange,
    updateEmpreendimento,
    exportarRelatorio
  } = useRelatorios('categorias');

  const typedDespesasPorCategoria = despesasPorCategoria as DespesasPorCategoriaData | undefined;
  const typedDespesasPorTempo = despesasPorTempo as DespesasPorTempoData | undefined;

  const { empreendimentos, isLoading: isLoadingEmpreendimentos } = useEmpreendimentos();

  const pieChartData = React.useMemo((): PieChartDataPoint[] => {
    const categorias = typedDespesasPorCategoria?.categorias || {};
    if (!categorias || Object.keys(categorias).length === 0) return [];

    const colors: Record<string, string> = {
      'Material': '#3b82f6',
      'Serviço': '#10b981',
      'Equipamento': '#f59e0b',
      'Taxas': '#ef4444',
      'Outros': '#8b5cf6'
    };

    return Object.entries(categorias).map(([category, value]): PieChartDataPoint => ({
      name: category,
      value: typeof value === 'number' ? value : 0,
      color: colors[category] || '#6b7280'
    }));
  }, [typedDespesasPorCategoria]);

  const barChartData = React.useMemo((): BarChartDataPoint[] => {
    const periodos = typedDespesasPorTempo?.periodos || [];
    if (!periodos || periodos.length === 0) return [];

    return periodos.map((periodo: PeriodoData): BarChartDataPoint => ({
      name: periodo.nome,
      value: typeof periodo.valor === 'number' ? periodo.valor : 0,
      color: '#3b82f6'
    }));
  }, [typedDespesasPorTempo]);

  const totalValue = React.useMemo((): number => {
    const categorias = typedDespesasPorCategoria?.categorias || {};
    if (!categorias) return 0;
    return Object.values(categorias).reduce((sum: number, categoryValue: number) => sum + (categoryValue || 0), 0);
  }, [typedDespesasPorCategoria]);

  const handleExport = async (tipo: 'excel' | 'pdf') => {
    await exportarRelatorio(tipo, {
      titulo: 'Relatório de Despesas por Categoria',
      incluirGraficos: true
    });
  };

  const getDateLabel = (range: DateRange | undefined): string => {
    if (!range?.from) return "Selecione o período";
    if (!range.to) return formatDateFns(range.from, "dd/MM/yyyy", { locale: ptBR });
    return `${formatDateFns(range.from, "dd/MM/yyyy", { locale: ptBR })} - ${formatDateFns(range.to, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  // Convertendo dateRange do hook para o formato aceito pela biblioteca de calendário
  const calendarDateRange: DateRange = {
    from: dateRange?.from,
    to: dateRange?.to
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !calendarDateRange.from && "text-muted-foreground"
                    )}
                    disabled={isLoadingCategorias || isLoadingTempo}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>{getDateLabel(calendarDateRange)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={calendarDateRange.from}
                    selected={calendarDateRange}
                    onSelect={(range: DateRange | undefined) => updateDateRange({
                      from: range?.from,
                      to: range?.to
                    })}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Empreendimento</label>
              <Select
                value={empreendimentoId}
                onValueChange={updateEmpreendimento}
                disabled={isLoadingEmpreendimentos || isLoadingCategorias || isLoadingTempo}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os empreendimentos</SelectItem>
                  {empreendimentos.map((emp: EmpreendimentoOption) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 flex items-end">
              <div className="flex space-x-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => handleExport('excel')}
                  disabled={isExportando || isLoadingCategorias || isLoadingTempo}
                  className="h-9"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => handleExport('pdf')}
                  disabled={isExportando || isLoadingCategorias || isLoadingTempo}
                  className="h-9"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total de Despesas</p>
              {isLoadingCategorias ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p className="text-3xl font-bold">{formatCurrency(totalValue)}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Maior Categoria</p>
              {isLoadingCategorias ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p className="text-3xl font-bold">
                  {typedDespesasPorCategoria?.maiorCategoria?.nome || 'N/A'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Período com Maior Gasto</p>
              {isLoadingTempo ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p className="text-3xl font-bold">
                  {typedDespesasPorTempo?.maiorPeriodo?.nome || 'N/A'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="categorias">
        <TabsList className="mb-4">
          <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          <TabsTrigger value="tempo">Por Período</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PieChart
              data={pieChartData}
              title="Despesas por Categoria"
              isLoading={isLoadingCategorias}
              height={350}
            />

            <Card>
              <CardHeader>
                <CardTitle>Detalhamento por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCategorias ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex justify-between items-center">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(typedDespesasPorCategoria?.categorias || {}).map(([category, value]) => (
                      <div key={category} className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div
                            className="h-3 w-3 rounded-full mr-2 flex-shrink-0"
                            style={{
                              backgroundColor: pieChartData.find(item => item.name === category)?.color
                            }}
                          />
                          <span className="truncate">{category}</span>
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="font-medium">{formatCurrency(typeof value === 'number' ? value : 0)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatPercent(totalValue > 0 && typeof value === 'number' ? value / totalValue : 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tempo">
          <div className="grid grid-cols-1 gap-6">
            <BarChart
              data={barChartData}
              title="Despesas por Período"
              isLoading={isLoadingTempo}
              height={350}
              formatValue={(value) => formatCurrency(value)}
            />

            <Card>
              <CardHeader>
                <CardTitle>Comparação entre Períodos</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTempo ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex justify-between items-center">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(typedDespesasPorTempo?.periodos || []).map((periodo: PeriodoData, index: number, arr: PeriodoData[]) => {
                      const prevPeriodo = index > 0 ? arr[index - 1] : null;
                      const variacao = prevPeriodo && prevPeriodo.valor !== 0 && typeof periodo.valor === 'number' && typeof prevPeriodo.valor === 'number'
                        ? ((periodo.valor - prevPeriodo.valor) / prevPeriodo.valor)
                        : null;

                      return (
                        <div key={periodo.nome} className="flex justify-between items-center">
                          <span>{periodo.nome}</span>
                          <div className="flex flex-col items-end">
                            <span className="font-medium">{formatCurrency(typeof periodo.valor === 'number' ? periodo.valor : 0)}</span>
                            {variacao !== null && (
                              <span className={`text-xs ${variacao > 0 ? 'text-green-600' : variacao < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {formatVariation(variacao * 100).text}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}