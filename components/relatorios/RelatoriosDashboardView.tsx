// components/relatorios/RelatoriosDashboardView.tsx
"use client";

import React, { Suspense, useMemo } from 'react'; // Import useMemo
import dynamic from 'next/dynamic';
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent, formatVariation } from '@/utils/format';
import { CircleDollarSign, Calendar, Target, Activity, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  KpiOutput,
  OrcamentoOutput,
  TendenciasOutput,
  DespesasPorCategoriaOutput,
  DespesasPorMesOutput
} from '@/server/api/schemas/relatorios';

// Carregamento dinâmico dos gráficos
const BarChart = dynamic(() => import('./charts/MonthlyBarChart').then(mod => mod.default), { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> });
const PieChart = dynamic(() => import('./charts/CategoriesPieChart').then(mod => mod.default), { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> });

interface RelatoriosDashboardViewProps {
  kpis?: KpiOutput;
  orcamento?: OrcamentoOutput;
  tendencias?: TendenciasOutput;
  despesasPorCategoria?: DespesasPorCategoriaOutput;
  despesasPorTempo?: DespesasPorMesOutput;
  isLoading: boolean;
}

// Componente reutilizável para Cards KPI
function MetricCard({ title, icon, value, subtext, subtextIcon, progress, progressColor, trendIcon, loading }: {
    title: string;
    icon: React.ReactNode;
    value: string | number | React.ReactNode;
    subtext?: string | null; // Accepts string or null
    subtextIcon?: React.ReactNode | null; // Accepts ReactNode or null
    progress?: number;
    progressColor?: string;
    trendIcon?: React.ReactNode;
    loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
             <div className="space-y-1">
                 <Skeleton className="h-7 w-3/4" />
                 {subtext !== undefined && <Skeleton className="h-4 w-1/2" />}
                 {progress !== undefined && <Skeleton className="h-2 w-full mt-2" />}
             </div>
         ) : (
            <>
                <div className="text-2xl font-bold flex items-center gap-1">{trendIcon}{value}</div>
                {/* Render subtext with optional icon */}
                {subtext !== undefined && subtext !== null && ( // Check for null as well
                    <div className={cn("text-xs text-muted-foreground mt-1 flex items-center gap-1", subtextIcon && (subtext?.startsWith('+') ? 'text-green-600' : subtext?.startsWith('-') ? 'text-red-600' : ''))}>
                      {subtextIcon}
                      <span>{subtext}</span> {/* No need for ?? "-" if we check for null */}
                    </div>
                )}
                 {/* Progress bar rendering */}
                 {progress !== undefined && progress !== null && !isNaN(progress) && (
                    <>
                      {/* Ensure value passed to Progress is never > 100 for visual correctness */}
                      <Progress value={Math.min(100, progress)} className="h-2 mt-2" indicatorClassName={progressColor} />
                      {progress > 100 && (
                        <span className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Orçamento excedido
                        </span>
                      )}
                      {progress <= 100 && (
                         <span className="text-xs text-muted-foreground mt-1">
                             {formatPercent(progress / 100, 0)} utilizado
                         </span>
                      )}
                    </>
                 )}
            </>
        )}
      </CardContent>
    </Card>
  );
}


export function RelatoriosDashboardView({
  kpis,
  orcamento,
  tendencias,
  despesasPorCategoria,
  despesasPorTempo,
  isLoading
}: RelatoriosDashboardViewProps) {

  const orcamentoData = useMemo(() => {
    const orcamentoTotal = orcamento?.total ?? 0;
    const utilizado = kpis?.totalDespesas ?? 0;
    const percentualUtilizado = orcamentoTotal > 0 ? Math.round((utilizado / orcamentoTotal) * 100) : 0;
    return { total: orcamentoTotal, utilizado, percentualUtilizado };
  }, [orcamento, kpis?.totalDespesas]);

  const budgetProgressColor = orcamentoData.percentualUtilizado > 100
    ? "bg-red-500"
    : orcamentoData.percentualUtilizado > 80
    ? "bg-amber-500"
    : "bg-primary";

  const totalDespesasSubResult = useMemo(() => {
    if (kpis?.crescimentoUltimoMes === undefined || kpis?.crescimentoUltimoMes === null) return "-";
    // Ensure formatVariation returns a consistent object structure or handle its potential return types
    const variation = formatVariation(kpis.crescimentoUltimoMes);
     // Check if variation returned the object structure
     if (typeof variation === 'object' && variation !== null && 'text' in variation && 'icon' in variation) {
         return { text: `${variation.text} vs mês anterior`, icon: variation.icon ? <variation.icon className="h-3 w-3" /> : null };
     }
     // Handle cases where formatVariation might return something else (or default)
     return { text: "-", icon: null }; // Fallback to a default object structure or just text
  }, [kpis?.crescimentoUltimoMes]);

  // *** FIX: Prepare props for MetricCard based on the result type ***
  let totalDespesasSubText: string | null = null;
  let totalDespesasSubIcon: React.ReactNode | null = null;

  if (totalDespesasSubResult === "-") {
    totalDespesasSubText = "-";
    totalDespesasSubIcon = null;
  } else {
    // Now we know it's the object
    totalDespesasSubText = totalDespesasSubResult.text;
    totalDespesasSubIcon = totalDespesasSubResult.icon;
  }
  // *** END FIX ***

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
     >
      {/* KPI Cards - Corrected */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Despesas"
          icon={<CircleDollarSign className="h-4 w-4 text-primary" />}
          value={formatCurrency(kpis?.totalDespesas ?? 0)}
          // *** FIX: Use the prepared variables ***
          subtext={totalDespesasSubText}
          subtextIcon={totalDespesasSubIcon}
          // *** END FIX ***
          loading={isLoading}
        />
        <MetricCard
          title="Média Mensal"
          icon={<Calendar className="h-4 w-4 text-blue-500" />}
          value={formatCurrency(kpis?.mediaMensal ?? 0)}
          subtext={kpis?.mesPico ? `Pico: ${kpis.mesPico.nome} (${formatCurrency(kpis.mesPico.valor)})` : null}
          loading={isLoading}
        />
        <MetricCard
          title="Orçamento"
          icon={<Target className="h-4 w-4 text-indigo-500" />}
          value={formatCurrency(orcamentoData.utilizado)}
          subtext={`de ${formatCurrency(orcamentoData.total)}`}
          progress={orcamentoData.percentualUtilizado}
          progressColor={budgetProgressColor}
          loading={isLoading}
        />
        <MetricCard
          title="Tendência Geral"
          icon={<Activity className="h-4 w-4 text-orange-500" />}
          value={
            kpis?.tendenciaGeral === 'aumento' ? 'Aumento' :
            kpis?.tendenciaGeral === 'queda' ? 'Queda' : 'Estável'
          }
          trendIcon={
            kpis?.tendenciaGeral === 'aumento' ? <TrendingUp className="h-5 w-5 text-red-500" /> :
            kpis?.tendenciaGeral === 'queda' ? <TrendingDown className="h-5 w-5 text-green-500" /> : <Activity className="h-5 w-5 text-muted-foreground" />
          }
          // Ensure tendencias is potentially undefined
          subtext={`Prev. Próx. Mês: ${formatCurrency(tendencias?.previsaoProximoMes ?? 0)}`}
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Despesas Mensais</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <BarChart data={despesasPorTempo} isLoading={isLoading} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <PieChart data={despesasPorCategoria} isLoading={isLoading} />
             </Suspense>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

