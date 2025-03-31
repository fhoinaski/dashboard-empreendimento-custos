"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
// --- CORREÇÃO AQUI ---
// Certifique-se de que a importação é NOMEADA (com chaves)
import { Loading } from "@/components/ui/loading";
// --- FIM DA CORREÇÃO ---

// Interface para os dados esperados da API
interface MonthlyExpenseData {
    name: string; // Ex: "Jan", "Fev"
    total: number;
}

export function RevenueChart() {
  const [isMounted, setIsMounted] = useState(false);
  const [data, setData] = useState<MonthlyExpenseData[]>([]); // Usar a interface
  const [isLoading, setIsLoading] = useState(true); // Inicia como true

  useEffect(() => {
    // Marca como montado apenas no cliente
    setIsMounted(true);

    async function fetchRevenueData() {
        // Reinicia o estado de loading a cada fetch
        setIsLoading(true);
        try {
            const response = await fetch("/api/despesas/monthly");
            if (!response.ok) {
                console.error(`Erro ${response.status} ao buscar dados de despesas mensais.`);
                // Lança um erro para ser pego pelo catch
                throw new Error("Falha ao buscar dados de despesas");
            }
            const monthlyData: MonthlyExpenseData[] = await response.json();
            setData(monthlyData);
        } catch (error) {
            console.error("Erro detalhado ao buscar dados de receita:", error);
            // Define dados de fallback em caso de erro
            setData([
                { name: "Jan", total: 0 }, { name: "Fev", total: 0 },
                { name: "Mar", total: 0 }, { name: "Abr", total: 0 },
                { name: "Mai", total: 0 }, { name: "Jun", total: 0 },
                { name: "Jul", total: 0 }, { name: "Ago", total: 0 },
                { name: "Set", total: 0 }, { name: "Out", total: 0 },
                { name: "Nov", total: 0 }, { name: "Dez", total: 0 },
            ]);
            // Você pode adicionar um toast de erro aqui se desejar
            // toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os dados do gráfico." });
        } finally {
            // Finaliza o loading independentemente do resultado
            setIsLoading(false);
        }
    }
    fetchRevenueData();
  }, []); // Executa apenas uma vez na montagem

  // --- Renderização Condicional ---
  // Mostra Loading se ainda não montou OU se está buscando dados
  if (!isMounted || isLoading) {
    return (
      <div className="h-[350px] flex items-center justify-center" aria-label="Carregando gráfico...">
        {/* Uso correto do componente Loading importado */}
        <Loading />
      </div>
    );
  }

  // Renderiza o gráfico se montado e não estiver carregando
  // Adiciona verificação se há dados para exibir uma mensagem
  if (data.length === 0 || data.every(item => item.total === 0)) {
     return (
         <div className="h-[350px] flex items-center justify-center text-center text-muted-foreground text-sm p-4 border rounded-md bg-muted/50">
             Não há dados de despesas suficientes para exibir o gráfico no período selecionado.
         </div>
     )
  }

  // Renderiza o gráfico com os dados
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}> {/* Ajuste margens */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11} // Ligeiramente menor
            tickLine={false}
            axisLine={false}
            padding={{ left: 10, right: 10 }} // Adiciona padding
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `R$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`} // Formato K ou valor normal
          width={45} // Define largura para evitar corte
        />
        <Tooltip
          formatter={(value: number, name: string) => [`R$ ${value.toLocaleString("pt-BR", {minimumFractionDigits: 2})}`, "Total"]} // Formato completo no tooltip
          labelFormatter={(label: string) => `${label}`} // Mostrar apenas o mês/nome
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            borderRadius: "var(--radius)", // Usa variável de raio
            boxShadow: "hsl(var(--shadow))", // Adiciona sombra se definida
            padding: "8px 12px", // Ajusta padding
            fontSize: "12px", // Ajusta fonte
          }}
          cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.5 }} // Cursor mais sutil
        />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} className="fill-primary" barSize={30} /> {/* Tamanho da barra opcional */}
      </BarChart>
    </ResponsiveContainer>
  );
}