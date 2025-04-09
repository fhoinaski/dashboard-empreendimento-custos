import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart as BarChartIcon } from 'lucide-react';

interface BarChartProps {
  data: {
    name: string;
    value: number;
    color?: string;
  }[];
  title?: string;
  height?: number;
  showValues?: boolean;
  isLoading?: boolean;
  formatValue?: (value: number) => string;
  maxValue?: number;
}

export function BarChart({
  data,
  title,
  height = 300,
  showValues = true,
  isLoading = false,
  formatValue = (value) => value.toString(),
  maxValue
}: BarChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {title && <Skeleton className="h-6 w-1/3 mb-4" />}
          <div style={{ height: `${height}px` }} className="flex items-end justify-between gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col items-center w-full">
                <Skeleton className={`w-full h-${20 + (i * 10)}`} />
                <Skeleton className="h-4 w-16 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcular o valor máximo para escala
  const calculatedMaxValue = maxValue || Math.max(...data.map(item => item.value), 0) * 1.1;
  
  return (
    <Card>
      <CardContent className="pt-6">
        {title && <h3 className="text-lg font-medium mb-4">{title}</h3>}
        
        {data.length > 0 ? (
          <div style={{ height: `${height}px` }} className="flex items-end justify-between gap-2">
            {data.map((item, index) => {
              const barHeight = calculatedMaxValue > 0 
                ? (item.value / calculatedMaxValue) * (height - 40) 
                : 0;
              
              return (
                <div key={index} className="flex flex-col items-center w-full">
                  <div 
                    className="w-full rounded-t-sm transition-all duration-500 ease-in-out"
                    style={{ 
                      height: `${barHeight}px`, 
                      backgroundColor: item.color || '#3b82f6',
                      minHeight: item.value > 0 ? '4px' : '0'
                    }}
                  />
                  {showValues && (
                    <div className="mt-2 text-xs text-center">
                      <div className="font-medium">{formatValue(item.value)}</div>
                      <div className="text-gray-500 truncate max-w-full" title={item.name}>
                        {item.name}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
            <BarChartIcon size={64} />
            <p className="mt-2">Sem dados para exibir</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
