// components/relatorios/relatorios-page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added useCallback
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
import type { DateRange } from "react-day-picker"; // Import DateRange type

export default function RelatoriosPageClient() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Call hooks at the top level
  const {
    kpis,
    orcamento,
    tendencias,
    despesasPorCategoria,
    despesasPorTempo,
    comparativoPeriodo,
    dateRange,
    empreendimentoId,
    updateDateRange, // This is the state setter: React.Dispatch<React.SetStateAction<DateRange>>
    updateEmpreendimento,
    isLoading,
    exportarRelatorio, // Keep export function
    // Removed isExportando from destructuring
  } = useRelatorios(activeTab);

  const { empreendimentos, isLoading: loadingEmpreendimentos } = useEmpreendimentos();

  // Define availableTabs after hooks
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

  // *** FIX: Wrapper function for date range change ***
  const handleDateRangeChange = useCallback((newRange: DateRange | undefined) => {
    // updateDateRange is the state setter, it can accept the new value directly
    updateDateRange(newRange || { from: undefined, to: undefined }); // Handle undefined case if necessary
  }, [updateDateRange]);
  // *** END FIX ***

  const isOverallLoading = status === "loading" || loadingEmpreendimentos || isLoading;

  if (isOverallLoading) {
     // Skeleton remains the same
     return (
       <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
         <Skeleton className="h-12 w-full sm:w-1/2" /> {/* Filters Skeleton */}
         <Skeleton className="h-10 w-full max-w-[800px] mx-auto" /> {/* TabsList Skeleton */}
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
      <RelatoriosFiltros
        dateRange={dateRange}
        empreendimentoId={empreendimentoId}
        empreendimentos={empreendimentos || []}
        isLoading={loadingEmpreendimentos || isLoading}
        // *** FIX: Pass the wrapper function ***
        onChangeDateRange={handleDateRangeChange}
        // *** END FIX ***
        onChangeEmpreendimento={updateEmpreendimento}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* TabsList and TabsContent remain the same */}
         <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 max-w-[800px] mx-auto">
          {availableTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-1.5 h-9">
              <tab.icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <RelatoriosDashboardView
            kpis={kpis}
            orcamento={orcamento}
            tendencias={tendencias}
            despesasPorCategoria={despesasPorCategoria}
            despesasPorTempo={despesasPorTempo}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="despesas">
          <DespesasDetalhadasView
            dateRange={dateRange}
            empreendimentoId={empreendimentoId}
          />
        </TabsContent>

        <TabsContent value="categorias">
           <CategoriasView data={despesasPorCategoria} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="tendencias">
          <TendenciasView
            data={{ tendencias, despesasPorTempo }}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="comparativo">
           <ComparativoView data={comparativoPeriodo} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}