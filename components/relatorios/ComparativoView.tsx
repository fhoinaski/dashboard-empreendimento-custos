// components/relatorios/ComparativoView.tsx
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';

export default function ComparativoView({ data }: any) {
  if (!data) return <Skeleton className="h-[400px]" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativo de Períodos</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        <ResponsiveContainer>
          <LineChart data={data.periodos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatCurrency(v as number)} />
            <Legend />
            <Line dataKey="atual" name="Atual" stroke="#3b82f6" />
            <Line dataKey="anterior" name="Anterior" stroke="#10b981" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
