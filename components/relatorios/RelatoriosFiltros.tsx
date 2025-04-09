"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

interface Props {
  dateRange: DateRange | undefined;
  empreendimentoId: string | undefined;
  empreendimentos: { _id: string; name: string }[];
  isLoading?: boolean;
  onChangeDateRange: (range: DateRange | undefined) => void;
  onChangeEmpreendimento: (id: string) => void;
}

export default function RelatoriosFiltros({
  dateRange,
  empreendimentoId = "todos",
  empreendimentos,
  isLoading = false,
  onChangeDateRange,
  onChangeEmpreendimento,
}: Props) {
  const getDateLabel = (range: DateRange | undefined): string => {
    if (!range?.from) return "Selecione o período";
    if (!range.to) return format(range.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={isLoading}
            className={cn("w-full sm:w-auto justify-start text-left font-normal h-9", !dateRange && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {getDateLabel(dateRange)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onChangeDateRange}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      <Select value={empreendimentoId} onValueChange={onChangeEmpreendimento} disabled={isLoading}>
        <SelectTrigger className="w-full sm:w-64 h-9">
          <SelectValue placeholder="Empreendimento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos Empreendimentos</SelectItem>
          {empreendimentos.map((emp) => (
            <SelectItem key={emp._id} value={emp._id}>
              {emp.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
