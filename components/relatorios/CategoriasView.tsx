// components/relatorios/CategoriasView.tsx
"use client";

import React, { useMemo } from 'react'; // Import useMemo
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend, Tooltip } from 'recharts'; // Rename imported PieChart
import { formatCurrency } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart as PieIcon } from 'lucide-react'; // Import icon for empty state

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280", "#ec4899"];

// Define a type for the input data prop
interface CategoriasViewData {
    categorias?: Record<string, number | unknown>; // Allow unknown initially
    // Add other properties from DespesasPorCategoriaOutput if needed
}

// Define the structure for the internal chart data points
interface ChartDataPoint {
    name: string;
    value: number; // Ensure this is always number
    color: string;
}

// Add isLoading prop
export default function CategoriasView({ data, isLoading }: { data?: CategoriasViewData, isLoading?: boolean }) {

  // Use useMemo to calculate chartData safely
  const chartData = useMemo((): ChartDataPoint[] => {
    const categorias = data?.categorias || {};
    const entries = Object.entries(categorias);
    const validEntries: ChartDataPoint[] = [];

    entries.forEach(([name, value], i) => {
        // Explicitly check if value is a number and positive
        if (typeof value === 'number' && !isNaN(value) && value > 0) {
            validEntries.push({
                name,
                value,
                color: COLORS[i % COLORS.length]
            });
        } else {
             // Optionally log ignored entries
             // console.warn(`Ignoring category "${name}" due to invalid value:`, value);
        }
    });

    // Sort descending by value
    return validEntries.sort((a, b) => b.value - a.value);

  }, [data]); // Recalculate when data changes

  // Render Skeleton if loading
  if (isLoading) {
      return (
          <Card>
              <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
              <CardContent className="h-[400px] flex items-center justify-center">
                  <Skeleton className="h-[240px] w-[240px] rounded-full" />
              </CardContent>
          </Card>
      );
  }
  // Render Empty state if not loading and no valid data
  if (!chartData || chartData.length === 0) {
      return (
          <Card>
               <CardHeader><CardTitle>Despesas por Categoria</CardTitle></CardHeader>
               <CardContent className="h-[400px] flex flex-col items-center justify-center text-center text-muted-foreground">
                   <PieIcon className="h-12 w-12 mb-4 opacity-50"/>
                   <p>Sem dados de categoria para exibir no período selecionado.</p>
               </CardContent>
          </Card>
      );
  }

  // Render Chart
  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart> {/* Use renamed import */}
            <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={120} // Adjust as needed
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                // Optional: Add label formatter
                 label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {chartData.map((entry, index) => (
                 // entry is now guaranteed to be ChartDataPoint
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number | string) => formatCurrency(typeof v === 'number' ? v : 0)} /> {/* Ensure value is number */}
            <Legend iconType="circle"/>
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}