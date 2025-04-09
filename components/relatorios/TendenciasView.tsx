// components/relatorios/TendenciasView.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';

export default function TendenciasView({ data }: any) {
  if (!data || !data.despesasPorTempo || !data.tendencias) return <Skeleton className="h-[400px]" />;

  const chartData = data.despesasPorTempo.periodos.map((p: any) => ({
    name: p.nome,
    valor: p.valor,
  }));

  chartData.push({ name: 'Próximo mês', previsto: data.tendencias.previsaoProximoMes });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendências de Despesas</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatCurrency(v as number)} />
            <Legend />
            <Line dataKey="valor" name="Realizado" stroke="#3b82f6" />
            <Line dataKey="previsto" name="Previsão" stroke="#f59e0b" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
