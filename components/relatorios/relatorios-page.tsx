// components/relatorios/relatorios-page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRelatorios } from '@/hooks/useRelatorios';
import { useEmpreendimentos } from '@/hooks/useEmpreendimentos';
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, PieChart, TrendingUp, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import { RelatoriosDashboardView } from './RelatoriosDashboardView';
import DespesasDetalhadasView from './DespesasDetalhadasView';
import CategoriasView from './CategoriasView';
import TendenciasView from './TendenciasView';
import ComparativoView from './ComparativoView';
import RelatoriosFiltros from "./RelatoriosFiltros";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils"; // Import cn if not already imported

export default function RelatoriosPageClient() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Hooks (no changes needed here)
  const {
    kpis,
    orcamento,
    tendencias,
    despesasPorCategoria,
    despesasPorTempo,
    comparativoPeriodo,
    dateRange,
    empreendimentoId,
    updateDateRange,
    updateEmpreendimento,
    isLoading,
    exportarRelatorio,
  } = useRelatorios(activeTab);

  const { empreendimentos, isLoading: loadingEmpreendimentos } = useEmpreendimentos();

  const availableTabs = useMemo(() => [
    { value: "dashboard", icon: BarChart3, label: "Dashboard" },
    { value: "despesas", icon: Wallet, label: "Despesas" },
    { value: "categorias", icon: PieChart, label: "Categorias" },
    { value: "tendencias", icon: TrendingUp, label: "Tendências" },
    { value: "comparativo", icon: LineChartIcon, label: "Comparativo" },
  ], []);

  useEffect(() => {
    if (status === "authenticated" && !availableTabs.some(t => t.value === activeTab)) {
      setActiveTab("dashboard");
    }
  }, [status, activeTab, availableTabs]);

  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    updateDateRange(newRange || { from: undefined, to: undefined });
  }, [updateDateRange]);

  const isOverallLoading = status === "loading" || loadingEmpreendimentos || isLoading;

  if (isOverallLoading) {
     return (
       <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
         {/* Filters Skeleton - Keep as is */}
         <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-9 w-full sm:w-64" />
            <Skeleton className="h-9 w-full sm:w-64" />
         </div>
         {/* TabsList Skeleton - Keep as is */}
         <Skeleton className="h-10 w-full max-w-[800px] mx-auto" />
         {/* Content Skeleton - Keep as is */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
           <Skeleton className="h-64 w-full" />
           <Skeleton className="h-64 w-full" />
           <Skeleton className="h-64 w-full" />
           <Skeleton className="h-64 w-full" />
         </div>
       </div>
     );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Filtros - Keep as is */}
      <RelatoriosFiltros
        dateRange={dateRange}
        empreendimentoId={empreendimentoId}
        empreendimentos={empreendimentos || []}
        isLoading={loadingEmpreendimentos || isLoading}
        onChangeDateRange={handleDateRangeChange}
        onChangeEmpreendimento={updateEmpreendimento}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* ===== RESPONSIVE TabsList START ===== */}
        <TabsList className={cn(
            "flex flex-wrap h-auto justify-center", // Use flex-wrap and allow auto height
            "rounded-md bg-muted p-1 text-muted-foreground", // Original background/text styles
            "max-w-[800px] mx-auto gap-1" // Keep max-width, centering and add gap
        )}>
          {availableTabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              // Removed flex-1, adjusted padding/height for better wrapping
              className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-sm",
                  "px-3 py-1.5 h-9", // Consistent padding and height
                  "text-xs sm:text-sm font-medium",
                  "ring-offset-background transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              )}
            >
              <tab.icon className="h-4 w-4 flex-shrink-0 mr-1.5" /> {/* Added margin */}
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {/* ===== RESPONSIVE TabsList END ===== */}


        {/* TabsContent - Keep as is */}
        <TabsContent value="dashboard" className="mt-4"> {/* Added mt-4 for spacing */}
          <RelatoriosDashboardView
            kpis={kpis}
            orcamento={orcamento}
            tendencias={tendencias}
            despesasPorCategoria={despesasPorCategoria}
            despesasPorTempo={despesasPorTempo}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="despesas" className="mt-4">
          <DespesasDetalhadasView
            dateRange={dateRange}
            empreendimentoId={empreendimentoId}
          />
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
           <CategoriasView data={despesasPorCategoria} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="tendencias" className="mt-4">
          <TendenciasView
            data={{ tendencias, despesasPorTempo }}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="comparativo" className="mt-4">
           <ComparativoView data={comparativoPeriodo} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}