// utils/format.ts
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { isValid, parseISO } from 'date-fns'; // Importar funções necessárias

// Função para formatar moeda (existente)
export const formatCurrency = (value: number): string => {
    if (typeof value !== 'number' || isNaN(value)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(0);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
};

// Função para formatar data (existente)
export const formatDate = (dateString: string | Date): string => {
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString; // Usa parseISO
      if (!isValid(date)) { // Verifica validade com date-fns
          return "Data inválida";
      }
      return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return "Data inválida";
    }
};

// Função para formatar data e hora (existente)
export const formatDateTime = (dateString: string | Date): string => {
     try {
       const date = typeof dateString === 'string' ? parseISO(dateString) : dateString; // Usa parseISO
       if (!isValid(date)) { // Verifica validade com date-fns
          return "Data/Hora inválida";
       }
       return new Intl.DateTimeFormat('pt-BR', {
         dateStyle: 'short',
         timeStyle: 'short',
         // timeZone: 'UTC' // Remover ou manter UTC conforme necessidade
       }).format(date);
     } catch (e) {
        console.error("Error formatting datetime:", dateString, e);
        return "Data/Hora inválida";
     }
};

// Função para formatar percentual (existente)
export const formatPercent = (value: number | null | undefined, minimumFractionDigits = 1): string => {
    if (typeof value !== 'number' || isNaN(value)) {
        return "-";
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
    }).format(value);
};

// Função para formatar variação (existente)
export const formatVariation = (value: number | null | undefined): { text: string; colorClass: string; icon?: React.ElementType } => {
    if (typeof value !== 'number' || isNaN(value)) {
        return { text: "N/A", colorClass: "text-muted-foreground" };
    }
    const formattedValue = formatPercent(Math.abs(value) / 100);

    if (value > 0) {
        return { text: `+${formattedValue}`, colorClass: "text-green-600", icon: ArrowUpRight };
    } else if (value < 0) {
        return { text: `-${formattedValue}`, colorClass: "text-red-600", icon: ArrowDownRight };
    } else {
        return { text: `0,0%`, colorClass: "text-muted-foreground" };
    }
};

// *** Função safeParseDate (ESSENCIAL) ***
export const safeParseDate = (dateInput: string | Date | undefined | null): Date | undefined => {
  if (!dateInput) return undefined;
  try {
    let date;
    if (typeof dateInput === 'string') {
      // Tenta parsear como ISO string primeiro
      date = parseISO(dateInput);
      // Se falhar ou resultar em data inválida, tenta construtor padrão (pode pegar formatos não-ISO)
      if (!isValid(date)) {
          date = new Date(dateInput);
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      return undefined;
    }
    // Verifica a validade final
    return isValid(date) ? date : undefined;
  } catch (e) {
    console.warn("safeParseDate error:", e);
    return undefined;
  }
};