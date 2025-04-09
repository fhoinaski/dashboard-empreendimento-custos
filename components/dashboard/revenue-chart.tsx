"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loading } from "@/components/ui/loading"; // Correct named import
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

// Interface for the data expected from the API
interface MonthlyData {
    name: string; // Ex: "Jan", "Fev"
    total: number;
}

// Props for the component (optional, if you want to pass filters later)
interface RevenueChartProps {
    // Add props like dateRange, empreendimentoId if needed
}

export function RevenueChart({ /* Add props here if needed */ }: RevenueChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [data, setData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true); // Mark as mounted on client

    async function fetchRevenueData() {
        setIsLoading(true);
        setError(null);
        setData([]); // Clear previous data

        try {
            // *** PLACEHOLDER API ENDPOINT ***
            // Replace '/api/despesas/monthly' with your actual revenue endpoint
            // e.g., '/api/revenue/monthly' or similar.
            // Pass necessary filters (dateRange, empreendimentoId) if applicable.
            const response = await fetch("/api/despesas/monthly"); // <<< CHANGE THIS ENDPOINT

            if (!response.ok) {
                console.error(`Erro ${response.status} ao buscar dados de receita.`);
                throw new Error("Falha ao buscar dados de receita");
            }
            const monthlyData: MonthlyData[] = await response.json();
            setData(monthlyData);
        } catch (err: any) {
            console.error("Erro detalhado ao buscar dados de receita:", err);
            setError(err.message || "Erro desconhecido");
            // Define dados de fallback em caso de erro
            setData(Array.from({ length: 12 }, (_, i) => ({ name: ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][i], total: 0 })));
        } finally {
            setIsLoading(false);
        }
    }
    fetchRevenueData();
    // Add dependencies here if props like dateRange, empreendimentoId are used
  }, []); // Execute only once on mount for now

  // --- Conditional Rendering ---
  if (!isMounted || isLoading) {
    return (
      <div className="h-[350px] flex items-center justify-center" aria-label="Carregando gráfico...">
         <Skeleton className="h-full w-full rounded-md" />
      </div>
    );
  }

  if (error) {
      return (
          <div className="h-[350px] flex flex-col items-center justify-center text-center text-destructive text-sm p-4 border border-destructive/50 rounded-md bg-destructive/10">
               <AlertTriangle className="h-8 w-8 mb-2"/>
              Não foi possível carregar o gráfico de receita.
              <p className="text-xs mt-1">(Erro: {error})</p>
          </div>
      )
  }

  const hasData = data.some(item => item.total > 0);
  if (!hasData) {
     return (
         <div className="h-[350px] flex items-center justify-center text-center text-muted-foreground text-sm p-4 border rounded-md bg-muted/50">
             Não há dados de receita para exibir no período selecionado.
         </div>
     )
  }

  // --- Render Chart ---
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} width={45} />
        <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR", {minimumFractionDigits: 2})}`, "Total"]} labelFormatter={(label: string) => `${label}`} contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: "12px" }} cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.5 }} />
        {/* Use a different color for revenue, e.g., green */}
        <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} className="fill-emerald-500" barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}