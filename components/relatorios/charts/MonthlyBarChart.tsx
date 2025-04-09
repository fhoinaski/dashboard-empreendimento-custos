"use client";
import React from 'react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Add isLoading prop
export default function MonthlyBarChart({ data, isLoading }: { data: any, isLoading?: boolean }) {
  const monthlyChartData = React.useMemo(() => {
    const periodos = data?.periodos || [];
    return periodos.map((periodo: any) => ({
      name: periodo.nome,
      value: periodo.valor ?? 0,
    }));
  }, [data]);

  // Render Skeleton if loading
  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  // Render chart if not loading
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={monthlyChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
        <Tooltip
            cursor={{ fill: 'hsl(var(--accent))', fillOpacity: 0.5 }}
            contentStyle={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: "12px" }}
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label: string) => `Mês: ${label}`}
        />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}