// components/calendario/calendario-page.tsx (Refatorado com tRPC e CORRIGIDO)
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Import React
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar as CalendarIconLucide, ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, Clock, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek, parseISO, isBefore, endOfDay, isValid, addDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

// --- Importar Hooks tRPC ---
import { useEmpreendimentos } from "@/hooks/useEmpreendimentos";
import { useDespesas } from "@/hooks/useDespesas";
// --- Importar Tipos tRPC ---
import type { ClientDespesa as TrpcClientDespesa, DespesaFilterParams } from '@/lib/trpc/types';

// --- TYPE DEFINITIONS ---
interface EmpreendimentoOption {
    _id: string;
    name: string;
}

interface ClientCalendarEvent {
  _id: string;
  title: string;
  date: string;
  status: string;
  type: 'despesa';
  value?: number;
  empreendimento: {
    _id: string;
    name: string;
  };
}
// --- END TYPE DEFINITIONS ---


export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string | undefined>(undefined);

  const [selectedEvent, setSelectedEvent] = useState<ClientCalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

// --- tRPC Hooks ---
const {
  empreendimentos: empreendimentoOptionsData,
  isLoading: isLoadingEmpreendimentos
} = useEmpreendimentos();

  const {
      despesas,
      isLoading: isLoadingDespesasHook,
      isFetching: isFetchingDespesasHook,
      updateFilters,
      updateDespesa,
      isUpdating: isUpdatingDespesa
  } = useDespesas();
  // --- Fim tRPC Hooks ---

  const isLoadingCalendar = isLoadingDespesasHook || isFetchingDespesasHook;
  const isFetchingFilters = isLoadingEmpreendimentos;

  const allEmpreendimentos: EmpreendimentoOption[] = useMemo(() => {
      return (empreendimentoOptionsData || []).map(emp => ({ _id: emp._id, name: emp.name }));
  }, [empreendimentoOptionsData]);

  const events: ClientCalendarEvent[] = useMemo(() => {
    return (despesas || [])
        .map((item): ClientCalendarEvent | null => {
            if (!item.dueDate || !isValid(parseISO(item.dueDate))) {
                console.warn(`[CalendarioPage] Invalid dueDate for despesa ${item._id}: ${item.dueDate}`);
                return null;
            }
            
            // Handle the case where empreendimento might be undefined
            if (!item.empreendimento) {
                console.warn(`[CalendarioPage] Missing empreendimento for despesa ${item._id}`);
                return null;
            }
            
            return {
                _id: item._id,
                title: item.description,
                date: item.dueDate,
                status: item.status,
                type: 'despesa',
                value: item.value,
                empreendimento: {
                    _id: item.empreendimento._id,
                    name: item.empreendimento.name
                }
            };
        })
        .filter((event): event is ClientCalendarEvent => event !== null);
}, [despesas]);


  // --- Atualizar Filtros tRPC ---
  useEffect(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const viewStart = startOfWeek(monthStart);
    const viewEnd = endOfWeek(monthEnd);

    const filtersToApply: DespesaFilterParams = {
        startDate: viewStart.toISOString(),
        endDate: viewEnd.toISOString(),
        empreendimento: empreendimentoFilter,
        // *** CORREÇÃO AQUI: Ajustar o limite para 100 ou menos ***
        limit: 100, // Alterado de 200 para 100 (ou outro valor <= 100)
        page: 1,
    };
    updateFilters(filtersToApply);

  }, [currentDate, empreendimentoFilter, updateFilters]);

  // --- Event Handlers ---
  const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleTodayClick = () => setCurrentDate(new Date());
  const handleDateClick = (date: Date) => setSelectedDate(date);

  const handleEventClick = (event: ClientCalendarEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  // --- Ação "Marcar como Pago" usando tRPC ---
  const handleMarkAsPaid = useCallback(async (eventId: string) => {
    try {
        await updateDespesa(eventId, { status: 'Pago' });
        setEventDialogOpen(false);
    } catch (error) {
        console.error("Erro ao marcar como pago (componente):", error);
    }
  }, [updateDespesa]);

  // --- Derived Data & Calculations ---
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) => {
        try { return isSameDay(parseISO(event.date), selectedDate); }
        catch { return false; }
    });
  }, [selectedDate, events]);

  const upcomingEvents = useMemo(() => {
    const today = endOfDay(new Date());
    const sevenDaysLater = addDays(today, 7);

    return events
      .filter((event) => {
        try {
            const eventDate = parseISO(event.date);
            return !['Pago', 'Concluído'].includes(event.status) &&
                   isValid(eventDate) &&
                   isBefore(eventDate, sevenDaysLater) &&
                   !isBefore(eventDate, today);
        } catch { return false; }
      })
      .sort((a, b) => {
          try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); }
          catch { return 0; }
      })
      .slice(0, 5);
  }, [events]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const displayStart = startOfWeek(monthStart);
  const displayEnd = endOfWeek(monthEnd);
  const daysInView = eachDayOfInterval({ start: displayStart, end: displayEnd });

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
        try {
            const dateStr = format(parseISO(event.date), 'yyyy-MM-dd');
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(event);
        } catch {}
        return acc;
    }, {} as Record<string, ClientCalendarEvent[]>);
  }, [events]);

  const getEventIndicators = (day: Date): React.ReactNode => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[dateStr] || [];
    if (dayEvents.length === 0) return null;
    const MAX_DOTS = 3;
    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-0.5">
        {dayEvents.slice(0, MAX_DOTS).map((event, index) => (
          <span key={index} className={cn("h-1.5 w-1.5 rounded-full",
            event.status === 'Pago' || event.status === 'Concluído' ? 'bg-green-500' :
            event.status === 'Pendente' || event.status === 'A vencer' ? 'bg-amber-500' :
            'bg-red-500'
          )} />
        ))}
        {dayEvents.length > MAX_DOTS && (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" title={`${dayEvents.length - MAX_DOTS} mais`} />
        )}
      </div>
    );
  };

  // --- Animation Variants ---
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 }}};
  const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 }};

  // --- JSX ---
  return (
    <TooltipProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6 p-4 sm:p-0"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Calendário</h2>
            <p className="text-sm text-muted-foreground">Visualize pagamentos e eventos importantes.</p>
          </div>
        </div>

        {/* Filters */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-2">
          <Select
            value={empreendimentoFilter ?? 'todos'}
            onValueChange={(value) => setEmpreendimentoFilter(value === 'todos' ? undefined : value)}
            disabled={isFetchingFilters || isLoadingCalendar}
          >
            <SelectTrigger className={cn("w-full sm:w-auto sm:flex-1 md:flex-none md:w-[240px] text-sm h-9", isFetchingFilters && "text-muted-foreground")}>
              <SelectValue placeholder={isFetchingFilters ? "Carregando..." : "Empreendimento"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Empreendimentos</SelectItem>
              {allEmpreendimentos.map((emp) => (
                <SelectItem key={emp._id} value={emp._id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Main Calendar Layout */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg capitalize">
                    {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-8 w-8" disabled={isLoadingCalendar}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Mês anterior</span></Button></TooltipTrigger><TooltipContent><p>Mês Anterior</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleTodayClick} className="h-8 w-8" disabled={isLoadingCalendar}><CalendarIconLucide className="h-4 w-4" /><span className="sr-only">Hoje</span></Button></TooltipTrigger><TooltipContent><p>Ir para Hoje</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8" disabled={isLoadingCalendar}><ChevronRight className="h-4 w-4" /><span className="sr-only">Próximo mês</span></Button></TooltipTrigger><TooltipContent><p>Próximo Mês</p></TooltipContent></Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2">
               {/* Calendar Grid */}
               {isLoadingCalendar ? (
                    <div className="grid grid-cols-7 gap-1">
                       {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => ( <div key={`skel-head-${day}`} className="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div> ))}
                       {Array.from({length: 35}).map((_, i) => ( <Skeleton key={`skel-day-${i}`} className="h-20 sm:h-24 rounded-md" /> ))}
                    </div>
               ) : (
                    <>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => ( <div key={day} className="py-1">{day}</div> ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {daysInView.map((day) => {
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isSel = selectedDate && isSameDay(day, selectedDate);
                            const isTod = isToday(day);
                            return (
                                <div
                                    key={day.toISOString()}
                                    className={cn(
                                        "relative h-20 sm:h-24 p-1.5 border rounded-md transition-colors cursor-pointer overflow-hidden",
                                        isCurrentMonth ? "bg-background hover:bg-muted/80" : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                                        isTod && "border-primary/50",
                                        isSel && "ring-2 ring-primary ring-offset-1 bg-primary/10"
                                    )}
                                    onClick={() => handleDateClick(day)}
                                >
                                    <span className={cn(
                                        "absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm",
                                        isTod && !isSel && "bg-primary text-primary-foreground",
                                        isSel && "bg-primary text-primary-foreground",
                                        !isCurrentMonth && "opacity-60"
                                    )}>
                                        {format(day, "d")}
                                    </span>
                                    {getEventIndicators(day)}
                                </div>
                            );
                        })}
                    </div>
                   </>
               )}
            </CardContent>
          </Card>

          {/* Painel Lateral */}
          <div className="space-y-6">
             {/* Próximos Eventos */}
             <Card>
                 <CardHeader className="pb-2 border-b"><CardTitle className="text-base">Próximos Eventos</CardTitle></CardHeader>
                 <CardContent className="p-3 max-h-[250px] overflow-y-auto">
                     {isLoadingCalendar && ( <div className="space-y-3"><Skeleton className="h-16 w-full"/><Skeleton className="h-16 w-full"/></div> )}
                     {!isLoadingCalendar && upcomingEvents.length > 0 && (
                         <div className="space-y-2">
                         {upcomingEvents.map((event) => (
                            <motion.div
                                key={`upcoming-${event._id}`}
                                variants={itemVariants}
                                className="flex flex-col p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleEventClick(event)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <Badge variant={ event.status === "Pago" || event.status === "Concluído" ? "outline" : event.status === "Pendente" || event.status === "A vencer" ? "secondary" : "destructive" } className={cn("text-[10px] px-1.5 py-0.5", event.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}>
                                        <span className="flex items-center gap-1">
                                            {event.status === "Pago" || event.status === "Concluído" ? <CheckCircle className="h-2.5 w-2.5" /> : event.status === "Pendente" || event.status === "A vencer" ? <Clock className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                                            {event.status}
                                        </span>
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{event.type === "despesa" ? "Despesa" : "Evento"}</Badge>
                                </div>
                                <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
                                <div className="flex items-center text-xs text-muted-foreground"><CalendarIconLucide className="h-3 w-3 mr-1" />{format(parseISO(event.date), "dd/MM/yyyy")}</div>
                                <div className="text-xs mt-0.5 line-clamp-1">{event.empreendimento.name}</div>
                            </motion.div>
                         ))}
                         </div>
                     )}
                     {!isLoadingCalendar && upcomingEvents.length === 0 && ( <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento próximo.</div> )}
                 </CardContent>
             </Card>

            {/* Eventos do Dia Selecionado */}
            {selectedDate && (
              <motion.div variants={itemVariants} initial="hidden" animate="show">
                <Card>
                  <CardHeader className="pb-2 border-b"><CardTitle className="text-base">{format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}</CardTitle></CardHeader>
                  <CardContent className="p-3 max-h-[250px] overflow-y-auto">
                     {isLoadingCalendar && ( <div className="space-y-3"><Skeleton className="h-16 w-full"/><Skeleton className="h-16 w-full"/></div> )}
                     {!isLoadingCalendar && selectedDateEvents.length > 0 && (
                       <div className="space-y-2">
                        {selectedDateEvents.map((event) => (
                            <motion.div
                                key={`selected-${event._id}`}
                                variants={itemVariants}
                                className="flex flex-col p-2 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleEventClick(event)}
                            >
                                <div className="flex items-center justify-between mb-1"><Badge variant={ event.status === "Pago" || event.status === "Concluído" ? "outline" : event.status === "Pendente" || event.status === "A vencer" ? "secondary" : "destructive" } className={cn("text-[10px] px-1.5 py-0.5", event.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}><span className="flex items-center gap-1">{event.status === "Pago" || event.status === "Concluído" ? <CheckCircle className="h-2.5 w-2.5" /> : event.status === "Pendente" || event.status === "A vencer" ? <Clock className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}{event.status}</span></Badge><Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{event.type === "despesa" ? "Despesa" : "Evento"}</Badge></div>
                                <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
                                <div className="flex items-center text-xs text-muted-foreground"><CalendarIconLucide className="h-3 w-3 mr-1" />{format(parseISO(event.date), "dd/MM/yyyy")}</div>
                                <div className="text-xs mt-0.5 line-clamp-1">{event.empreendimento.name}</div>
                                {event.value && <div className="text-sm font-medium mt-1">R$ {event.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>}
                            </motion.div>
                        ))}
                        </div>
                     )}
                     {!isLoadingCalendar && selectedDateEvents.length === 0 && ( <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento neste dia.</div> )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Dialog de Detalhes do Evento */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? "Detalhes do Evento"}</DialogTitle>
              <DialogDescription>{selectedEvent ? `${selectedEvent.type === 'despesa' ? 'Despesa' : 'Evento'} em ${selectedEvent.empreendimento.name}` : ''}</DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Status:</span><Badge variant={ selectedEvent.status === "Pago" || selectedEvent.status === "Concluído" ? "outline" : selectedEvent.status === "Pendente" || selectedEvent.status === "A vencer" ? "secondary" : "destructive" } className={cn("text-xs", selectedEvent.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}><span className="flex items-center gap-1">{selectedEvent.status === "Pago" || selectedEvent.status === "Concluído" ? <CheckCircle className="h-3 w-3" /> : selectedEvent.status === "Pendente" || selectedEvent.status === "A vencer" ? <Clock className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{selectedEvent.status}</span></Badge></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Data:</span><span className="text-sm font-medium">{format(parseISO(selectedEvent.date), "dd/MM/yyyy", { locale: ptBR })}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Empreendimento:</span><span className="text-sm font-medium">{selectedEvent.empreendimento.name}</span></div>
                {selectedEvent.value !== undefined && (<div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Valor:</span><span className="text-sm font-medium">R$ {selectedEvent.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>)}
              </div>
            )}
             <DialogFooter className="flex-col sm:flex-row gap-2">
                 <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Fechar</Button>
                {/* Botão Marcar como Pago */}
                {selectedEvent?.type === "despesa" && !['Pago', 'Concluído'].includes(selectedEvent.status) && (
                    <Button onClick={() => handleMarkAsPaid(selectedEvent._id)} disabled={isUpdatingDespesa}>
                        {isUpdatingDespesa ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Marcar como Pago
                    </Button>
                )}
                 {/* Botão Ver Detalhes Completos */}
                 {selectedEvent && ( <Button variant="default" asChild> <Link href={selectedEvent.type === 'despesa' ? `/dashboard/despesas/${selectedEvent._id}` : `/dashboard/eventos/${selectedEvent._id}`}>Ver Detalhes Completos</Link> </Button> )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  );
}