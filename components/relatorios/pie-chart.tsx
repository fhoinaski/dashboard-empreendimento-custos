import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart as PieChartIcon } from 'lucide-react';

interface PieChartProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
  title?: string;
  height?: number;
  showLegend?: boolean;
  isLoading?: boolean;
}

export function PieChart({
  data,
  title,
  height = 300,
  showLegend = true,
  isLoading = false
}: PieChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          {title && <Skeleton className="h-6 w-1/3 mb-4" />}
          <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
          </div>
          {showLegend && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center">
                  <Skeleton className="h-3 w-3 mr-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Calcular o total para percentuais
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calcular ângulos para o gráfico
  let startAngle = 0;
  const segments = data.map(item => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const angle = total > 0 ? (item.value / total) * 360 : 0;
    const segment = {
      ...item,
      percentage,
      startAngle,
      endAngle: startAngle + angle
    };
    startAngle += angle;
    return segment;
  });

  // Função para converter ângulos em coordenadas SVG
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Função para criar o path de um segmento
  const createArc = (segment: any, centerX: number, centerY: number, radius: number) => {
    const start = polarToCartesian(centerX, centerY, radius, segment.endAngle);
    const end = polarToCartesian(centerX, centerY, radius, segment.startAngle);
    const largeArcFlag = segment.endAngle - segment.startAngle <= 180 ? "0" : "1";
    
    return [
      "M", centerX, centerY,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  const centerX = 100;
  const centerY = 100;
  const radius = 80;

  return (
    <Card>
      <CardContent className="pt-6">
        {title && <h3 className="text-lg font-medium mb-4">{title}</h3>}
        
        <div className="flex justify-center items-center" style={{ height: `${height}px` }}>
          {total > 0 ? (
            <svg width="200" height="200" viewBox="0 0 200 200">
              {segments.map((segment, index) => (
                <path
                  key={index}
                  d={createArc(segment, centerX, centerY, radius)}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="1"
                />
              ))}
            </svg>
          ) : (
            <div className="flex flex-col items-center text-gray-400">
              <PieChartIcon size={64} />
              <p className="mt-2">Sem dados para exibir</p>
            </div>
          )}
        </div>
        
        {showLegend && total > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {segments.map((segment, index) => (
              <div key={index} className="flex items-center">
                <div 
                  className="h-3 w-3 mr-2 rounded-sm" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm">
                  {segment.name} ({segment.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
