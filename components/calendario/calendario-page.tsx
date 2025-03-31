"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation"; // Use router for potential navigation
import { motion } from "framer-motion";
import { Calendar as CalendarIconLucide, ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle, Clock, Info, Loader2 } from "lucide-react"; // Renamed Calendar icon import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Keep Dialog for details
import { Calendar } from "@/components/ui/calendar"; // The actual calendar component
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek, parseISO, isBefore, endOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

// --- TYPE DEFINITIONS (Ideally move to types/index.ts) ---
interface EmpreendimentoOption {
    _id: string;
    name: string;
}

// Represents the structure expected from the API for calendar items
interface ClientCalendarEvent {
  _id: string;
  title: string; // Or description
  date: string; // ISO Date String (e.g., dueDate for despesas)
  status: string; // e.g., 'Pago', 'Pendente', 'A vencer', 'Concluído', 'Agendado'
  type: 'despesa' | 'evento'; // Differentiate event types
  value?: number; // Optional value for despesas
  empreendimento: {
    _id: string;
    name: string;
  };
}
// --- END TYPE DEFINITIONS ---


export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date()); // Controls the displayed month
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); // The day clicked by the user
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos"); // Filter for 'despesa' or 'evento'

  const [allEmpreendimentos, setAllEmpreendimentos] = useState<EmpreendimentoOption[]>([]);
  const [events, setEvents] = useState<ClientCalendarEvent[]>([]); // Holds events for the current view range

  // Loading states
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(true); // Loading for main calendar data
  const [isFetchingFilters, setIsFetchingFilters] = useState(true); // Loading for filter options
  const [isActionLoading, setIsActionLoading] = useState<string | false>(false); // For actions like 'Mark as Paid'

  const [selectedEvent, setSelectedEvent] = useState<ClientCalendarEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  // --- Data Fetching ---

  // Fetch Empreendimentos for Filter Dropdown
  useEffect(() => {
    let isMounted = true;
    async function fetchEmpreendimentos() {
      setIsFetchingFilters(true);
      try {
        const response = await fetch("/api/empreendimentos?limit=999"); // Fetch all for filter
        if (!response.ok) throw new Error("Falha ao carregar empreendimentos");
        const data = await response.json();
        if (isMounted && data && Array.isArray(data.empreendimentos)) {
          setAllEmpreendimentos(data.empreendimentos.map((emp: any) => ({ _id: emp._id, name: emp.name })));
        }
      } catch (error) {
        console.error("Erro ao carregar empreendimentos para filtro:", error);
        // Optionally show toast or just leave the filter empty/disabled
      } finally {
        if (isMounted) setIsFetchingFilters(false);
      }
    }
    fetchEmpreendimentos();
    return () => { isMounted = false };
  }, []);

  // Fetch Calendar Events based on current month view and filters
  useEffect(() => {
    let isMounted = true;
    async function fetchEvents() {
      setIsLoadingCalendar(true);
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      // Fetch slightly wider range to potentially show events bleeding into prev/next month shown in grid
      const viewStart = startOfWeek(monthStart);
      const viewEnd = endOfWeek(monthEnd);

      const params = new URLSearchParams({
        from: viewStart.toISOString(),
        to: viewEnd.toISOString(),
      });
      if (empreendimentoFilter !== "todos") {
        params.set("empreendimento", empreendimentoFilter);
      }
      // Add type filter if API supports it
      // if (typeFilter !== "todos") {
      //     params.set("type", typeFilter);
      // }

      try {
        // ADJUST API ENDPOINT AS NEEDED
        const response = await fetch(`/api/despesas?${params.toString()}`); // Assuming despesas API is used
        if (!response.ok) throw new Error("Falha ao buscar eventos do calendário");
        const data = await response.json(); // Expect { despesas: [...] } or similar

        if (isMounted) {
           // Map API response to ClientCalendarEvent structure
           const fetchedEvents = (data.despesas || []).map((item: any): ClientCalendarEvent => ({
               _id: item._id,
               title: item.description,
               date: item.dueDate, // Using dueDate for despesas as the primary date
               status: item.status,
               type: 'despesa', // Assuming this endpoint only returns despesas
               value: item.value,
               empreendimento: {
                   _id: item.empreendimento?._id ?? 'unknown',
                   name: item.empreendimento?.name ?? 'Desconhecido'
               }
           }));
           // Add logic here to fetch and merge 'evento' type if from another endpoint
           setEvents(fetchedEvents);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao buscar eventos:", error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os eventos." });
          setEvents([]); // Clear events on error
        }
      } finally {
        if (isMounted) setIsLoadingCalendar(false);
      }
    }
    fetchEvents();
    return () => { isMounted = false };
  }, [currentDate, empreendimentoFilter, typeFilter, toast]); // Refetch when view or filters change

  // --- Event Handlers ---

  const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleTodayClick = () => setCurrentDate(new Date());
  const handleDateClick = (date: Date) => setSelectedDate(date);

  const handleEventClick = (event: ClientCalendarEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  const handleMarkAsPaid = async (eventId: string) => {
    setIsActionLoading(eventId);
    try {
        const formData = new FormData();
        formData.append("status", "Pago");
        // Assuming this API endpoint updates the status
        const response = await fetch(`/api/despesas/${eventId}`, {
            method: "PUT",
            body: formData,
        });
        if (!response.ok) throw new Error("Falha ao marcar como pago");

        // Update local state for immediate UI feedback
        setEvents(prevEvents =>
            prevEvents.map(event =>
                event._id === eventId ? { ...event, status: 'Pago' } : event
            )
        );
        toast({ title: "Sucesso", description: "Item marcado como pago." });
        setEventDialogOpen(false); // Close dialog on success
    } catch (error) {
        console.error("Erro ao marcar como pago:", error);
        toast({ variant: "destructive", title: "Erro", description: "Não foi possível marcar item como pago." });
    } finally {
        setIsActionLoading(false);
    }
};


  // --- Derived Data & Calculations ---

  // Filter events for the selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((event) => isSameDay(parseISO(event.date), selectedDate));
  }, [selectedDate, events]);

  // Filter upcoming events (next 7 days, not already paid/completed)
  const upcomingEvents = useMemo(() => {
    const today = endOfDay(new Date()); // Include events happening today
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    return events
      .filter((event) => {
        const eventDate = parseISO(event.date);
        return !['Pago', 'Concluído'].includes(event.status) &&
               isBefore(eventDate, sevenDaysLater) &&
               !isBefore(eventDate, today); // Exclude past events, include today
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
      .slice(0, 5); // Limit to 5 upcoming events
  }, [events]);

  // Calendar display logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  // Get dates for the full weeks overlapping the current month
  const displayStart = startOfWeek(monthStart);
  const displayEnd = endOfWeek(monthEnd);
  const daysInView = eachDayOfInterval({ start: displayStart, end: displayEnd });

  // Group events by date string for quick lookup during rendering
  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      const dateStr = format(parseISO(event.date), 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(event);
      return acc;
    }, {} as Record<string, ClientCalendarEvent[]>);
  }, [events]);

  // Function to get event indicators for a specific day
  const getEventIndicators = (day: Date): React.ReactNode => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayEvents = eventsByDate[dateStr] || [];
    if (dayEvents.length === 0) return null;

    // Simple dot indicators (adjust as needed)
    const MAX_DOTS = 3;
    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-0.5">
        {dayEvents.slice(0, MAX_DOTS).map((event, index) => (
          <span key={index} className={cn("h-1.5 w-1.5 rounded-full",
            event.status === 'Pago' || event.status === 'Concluído' ? 'bg-green-500' :
            event.status === 'Pendente' ? 'bg-red-500' : 'bg-amber-500'
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

  return (
    <TooltipProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6 p-4 sm:p-0" // Rely on parent padding
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Calendário</h2>
            <p className="text-sm text-muted-foreground">Visualize pagamentos e eventos importantes.</p>
          </div>
           {/* Consider adding a "Novo Evento" button if applicable */}
           {/* <Button size="sm" className="w-full sm:w-auto h-9">
                <Plus className="mr-2 h-4 w-4" /> Novo Evento/Lembrete
           </Button> */}
        </div>

        {/* Filters */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-2">
          <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter} disabled={isFetchingFilters || isLoadingCalendar}>
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

          {/* Optional Type Filter */}
          {/* <Select value={typeFilter} onValueChange={setTypeFilter} disabled={isLoadingCalendar}>
            <SelectTrigger className="w-full sm:w-[180px] text-sm h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="despesa">Despesas (Venc.)</SelectItem>
              <SelectItem value="evento">Eventos</SelectItem>
            </SelectContent>
          </Select> */}
        </motion.div>

        {/* Main Calendar Layout */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg capitalize"> {/* Capitalize month name */}
                    {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="h-8 w-8" disabled={isLoadingCalendar}>
                        <ChevronLeft className="h-4 w-4" /><span className="sr-only">Mês anterior</span>
                    </Button>
                  </TooltipTrigger><TooltipContent><p>Mês Anterior</p></TooltipContent></Tooltip>
                   <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleTodayClick} className="h-8 w-8" disabled={isLoadingCalendar}>
                        <CalendarIconLucide className="h-4 w-4" /><span className="sr-only">Hoje</span>
                    </Button>
                   </TooltipTrigger><TooltipContent><p>Ir para Hoje</p></TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8" disabled={isLoadingCalendar}>
                        <ChevronRight className="h-4 w-4" /><span className="sr-only">Próximo mês</span>
                    </Button>
                  </TooltipTrigger><TooltipContent><p>Próximo Mês</p></TooltipContent></Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2"> {/* Reduced padding */}
               {/* Calendar Grid */}
               {isLoadingCalendar ? (
                    <div className="grid grid-cols-7 gap-1">
                       {/* Weekday headers */}
                       {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => ( <div key={`skel-head-${day}`} className="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div> ))}
                       {/* Day Skeletons */}
                       {Array.from({length: 35}).map((_, i) => ( <Skeleton key={`skel-day-${i}`} className="h-20 sm:h-24 rounded-md" /> ))}
                    </div>
               ) : (
                    <>
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => ( <div key={day} className="py-1">{day}</div> ))}
                    </div>
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {daysInView.map((day) => {
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isSel = selectedDate && isSameDay(day, selectedDate);
                        const isTod = isToday(day);
                        return (
                            <div
                            key={day.toISOString()}
                            className={cn(
                                "relative h-20 sm:h-24 p-1.5 border rounded-md transition-colors cursor-pointer overflow-hidden", // Added overflow-hidden
                                isCurrentMonth ? "bg-background hover:bg-muted/80" : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                                isTod && "border-primary/50",
                                isSel && "ring-2 ring-primary ring-offset-1 bg-primary/10", // Selected style
                            )}
                            onClick={() => handleDateClick(day)}
                            >
                            <span
                                className={cn(
                                "absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm",
                                isTod && !isSel && "bg-primary text-primary-foreground", // Today style
                                isSel && "bg-primary text-primary-foreground", // Ensure selected text is visible
                                !isCurrentMonth && "opacity-60"
                                )}
                            >
                                {format(day, "d")}
                            </span>
                            {/* Event Indicators */}
                             {getEventIndicators(day)}
                            </div>
                        );
                        })}
                    </div>
                   </>
               )}
            </CardContent>
          </Card>

          {/* Side Panel (Upcoming & Selected Day) */}
          <div className="space-y-6">
             {/* Upcoming Events */}
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
                                    <Badge variant={ event.status === "Pago" || event.status === "Concluído" ? "outline" : event.status === "Pendente" ? "destructive" : "secondary" } className={cn("text-[10px] px-1.5 py-0.5", event.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}>
                                        <span className="flex items-center gap-1">
                                            {event.status === "Pago" || event.status === "Concluído" ? <CheckCircle className="h-2.5 w-2.5" /> : event.status === "Pendente" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                            {event.status}
                                        </span>
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{event.type === "despesa" ? "Despesa" : "Evento"}</Badge>
                                </div>
                                <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <CalendarIconLucide className="h-3 w-3 mr-1" />
                                    {format(parseISO(event.date), "dd/MM/yyyy")}
                                </div>
                                <div className="text-xs mt-0.5 line-clamp-1">{event.empreendimento.name}</div>
                            </motion.div>
                         ))}
                         </div>
                     )}
                      {!isLoadingCalendar && upcomingEvents.length === 0 && (
                           <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento próximo.</div>
                      )}
                 </CardContent>
             </Card>

            {/* Selected Day Events */}
            {selectedDate && (
              <motion.div variants={itemVariants} initial="hidden" animate="show">
                <Card>
                  <CardHeader className="pb-2 border-b">
                    <CardTitle className="text-base">
                      {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </CardTitle>
                  </CardHeader>
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
                                <div className="flex items-center justify-between mb-1">
                                     <Badge variant={ event.status === "Pago" || event.status === "Concluído" ? "outline" : event.status === "Pendente" ? "destructive" : "secondary" } className={cn("text-[10px] px-1.5 py-0.5", event.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}>
                                        <span className="flex items-center gap-1">
                                            {event.status === "Pago" || event.status === "Concluído" ? <CheckCircle className="h-2.5 w-2.5" /> : event.status === "Pendente" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                            {event.status}
                                        </span>
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">{event.type === "despesa" ? "Despesa" : "Evento"}</Badge>
                                </div>
                                <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
                                <div className="flex items-center text-xs text-muted-foreground">
                                    <CalendarIconLucide className="h-3 w-3 mr-1" />
                                    {format(parseISO(event.date), "dd/MM/yyyy")}
                                </div>
                                <div className="text-xs mt-0.5 line-clamp-1">{event.empreendimento.name}</div>
                                {event.value && <div className="text-sm font-medium mt-1">R$ {event.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>}
                            </motion.div>
                        ))}
                        </div>
                     )}
                      {!isLoadingCalendar && selectedDateEvents.length === 0 && (
                           <div className="text-center py-6 text-sm text-muted-foreground">Nenhum evento neste dia.</div>
                      )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Event Details Dialog */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? "Detalhes do Evento"}</DialogTitle>
              <DialogDescription>
                  {selectedEvent ? `${selectedEvent.type === 'despesa' ? 'Despesa' : 'Evento'} em ${selectedEvent.empreendimento.name}` : ''}
              </DialogDescription>
            </DialogHeader>

            {selectedEvent && (
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={ selectedEvent.status === "Pago" || selectedEvent.status === "Concluído" ? "outline" : selectedEvent.status === "Pendente" ? "destructive" : "secondary" } className={cn("text-xs", selectedEvent.status === "Pago" && "border-green-500 text-green-700 bg-green-50")}>
                        <span className="flex items-center gap-1">
                            {selectedEvent.status === "Pago" || selectedEvent.status === "Concluído" ? <CheckCircle className="h-3 w-3" /> : selectedEvent.status === "Pendente" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {selectedEvent.status}
                        </span>
                    </Badge>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Data:</span>
                    <span className="text-sm font-medium">{format(parseISO(selectedEvent.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Empreendimento:</span>
                    <span className="text-sm font-medium">{selectedEvent.empreendimento.name}</span>
                </div>
                {selectedEvent.value !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor:</span>
                    <span className="text-sm font-medium">R$ {selectedEvent.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  </div>
                )}
                 {/* Add more details here if needed */}
              </div>
            )}
             <DialogFooter className="flex-col sm:flex-row gap-2">
                 <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Fechar</Button>
                {selectedEvent?.type === "despesa" && !['Pago', 'Concluído'].includes(selectedEvent.status) && (
                    <Button onClick={() => handleMarkAsPaid(selectedEvent._id)} disabled={isActionLoading === selectedEvent._id}>
                        {isActionLoading === selectedEvent._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Marcar como Pago
                    </Button>
                )}
                 {/* Button to view full details */}
                 {selectedEvent && (
                      <Button variant="default" asChild>
                         <Link href={selectedEvent.type === 'despesa' ? `/dashboard/despesas/${selectedEvent._id}` : `/dashboard/eventos/${selectedEvent._id}`}> {/* Adjust link based on type */}
                            Ver Detalhes Completos
                         </Link>
                      </Button>
                 )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  );
}