// components/dashboard/expense-chart.tsx (Renomeado e modificado)
"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loading } from "@/components/ui/loading";
import { DateRange } from "react-day-picker";
import { AlertTriangle } from "lucide-react";

interface MonthlyExpenseData { name: string; total: number; }

// Props para o componente do gráfico
interface ExpenseChartProps {
    dateRange?: DateRange;
    empreendimentoId?: string; // <-- NOVO: Adicionar prop para ID
}

export function ExpenseChart({ dateRange, empreendimentoId }: ExpenseChartProps) { // <-- Usar a prop
  const [data, setData] = useState<MonthlyExpenseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExpenseData() {
        setIsLoading(true);
        setError(null);
        setData([]);

        const params = new URLSearchParams();
        if (dateRange?.from) params.set("from", dateRange.from.toISOString());
        if (dateRange?.to) params.set("to", dateRange.to.toISOString());
        // Adicionar empreendimentoId se for válido e diferente de "todos"
        if (empreendimentoId && empreendimentoId !== 'todos') {
            params.set("empreendimento", empreendimentoId); // <-- NOVO: Passar ID para API
        }

        try {
            const response = await fetch(`/api/despesas/monthly?${params.toString()}`);
            if (!response.ok) { throw new Error(`Erro ${response.status}`); }
            const monthlyData: MonthlyExpenseData[] = await response.json();
            setData(monthlyData);
        } catch (err) {
            console.error("Erro ao buscar dados para o gráfico:", err);
            setError(err instanceof Error ? err.message : "Falha ao carregar dados.");
            setData(Array.from({ length: 12 }, (_, i) => ({ name: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i], total: 0 })));
        } finally {
            setIsLoading(false);
        }
    }
    fetchExpenseData();
    // Re-executa quando dateRange OU empreendimentoId mudar
  }, [dateRange, empreendimentoId]); // <-- NOVO: Adicionar empreendimentoId como dependência


  // --- Renderização Condicional ---
  if (isLoading) {
    return (
      <div className="h-[350px] flex items-center justify-center" aria-label="Carregando gráfico...">
        <Loading />
      </div>
    );
  }

  if (error) {
      return (
          <div className="h-[350px] flex flex-col items-center justify-center text-center text-destructive text-sm p-4 border border-destructive/50 rounded-md bg-destructive/10">
              <AlertTriangle className="h-8 w-8 mb-2"/>
              Não foi possível carregar o gráfico.
              <p className="text-xs mt-1">(Erro: {error})</p>
          </div>
      )
  }

  // Verifica se há dados significativos para exibir
  const hasData = data.some(item => item.total > 0);
  if (!hasData) {
     return (
         <div className="h-[350px] flex items-center justify-center text-center text-muted-foreground text-sm p-4 border rounded-md bg-muted/50">
             Não há dados de despesas para exibir no período selecionado.
         </div>
     )
  }

  // Renderiza o gráfico com os dados
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        {/* ... (resto do código do gráfico inalterado) ... */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} width={45} />
        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", {minimumFractionDigits: 2})}`, "Total"]} labelFormatter={(label: string) => `${label}`} contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: "12px" }} cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.5 }} />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} className="fill-primary" barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}