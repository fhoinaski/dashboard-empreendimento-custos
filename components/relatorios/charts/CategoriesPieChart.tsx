"use client";
import React, { useMemo } from 'react'; // Import useMemo
import { ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280", "#ec4899"];

// Define a more specific type for the expected input data structure
interface CategoriesChartInputData {
    categorias?: Record<string, number | unknown>; // Allow unknown for initial flexibility
}

// Define the structure for the internal chart data points
interface ChartDataPoint {
    name: string;
    value: number; // Ensure this is always number after processing
    color: string;
}


// Add isLoading prop and use the specific input type
export default function CategoriesPieChart({ data, isLoading }: { data?: CategoriesChartInputData, isLoading?: boolean }) {
  const categoryChartData = useMemo((): ChartDataPoint[] => { // Explicit return type
    const categorias = data?.categorias || {};
    // Filter out categories with zero or invalid values before mapping
    return Object.entries(categorias)
      .map(([name, value], index): ChartDataPoint | null => { // Map to ChartDataPoint or null
          // Ensure value is a number, default to 0 if not or negative
          const numericValue = (typeof value === 'number' && value > 0) ? value : 0;
          if (numericValue === 0) {
              return null; // Exclude items with zero value from the chart data
          }
          return {
            name,
            value: numericValue,
            color: COLORS[index % COLORS.length],
          };
      })
      .filter((item): item is ChartDataPoint => item !== null) // Filter out the null entries
      // *** FIX: Explicitly check types before sorting ***
      .sort((a, b) => {
        const valueA = typeof a.value === 'number' ? a.value : 0;
        const valueB = typeof b.value === 'number' ? b.value : 0;
        return valueB - valueA; // Sort descending by numeric value
      });
  }, [data]);

  // Render Skeleton if loading
  if (isLoading) {
    return <Skeleton className="h-full w-full rounded-full" />; // Use rounded-full for pie chart skeleton
  }

  // Render chart if not loading
  return (
    <ResponsiveContainer width="100%" height="100%">
      {categoryChartData.length > 0 ? ( // Only render chart if there's data
        <RechartsPieChart>
          <Pie
             data={categoryChartData}
             cx="50%"
             cy="50%"
             labelLine={false}
             outerRadius={110} // Adjust radius as needed
             fill="#8884d8"
             dataKey="value"
             nameKey="name"
           >
            {categoryChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend iconType="circle" />
        </RechartsPieChart>
      ) : (
         <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
             Sem dados de categoria para exibir.
         </div>
      )}
    </ResponsiveContainer>
  );
}