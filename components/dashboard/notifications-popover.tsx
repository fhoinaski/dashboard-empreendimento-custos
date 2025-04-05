// components/dashboard/notifications-popover.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Clock, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow, parseISO, isToday, isFuture, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/NotificationContext"; // <- Importar o hook do contexto

// --- Tipos (Idealmente importar de um local compartilhado, ex: types/index.ts) ---
interface ClientDespesa {
  _id: string;
  description: string;
  dueDate: string; // ISO String
  status: string;
  empreendimento: { name: string; _id: string };
  value?: number; // Valor da despesa
}

interface NotificationItem {
  id: string; // ID da despesa
  title: string; // Descrição da despesa
  description: string; // Texto adicional, ex: nome do empreendimento
  relativeDate: string; // Texto relativo à data, ex: "Vence hoje", "Atrasado há 2 dias"
  href: string; // Link para a página de detalhes da despesa
  isOverdue: boolean; // Indica se está atrasado
  isUpcoming: boolean; // Indica se vence hoje ou no futuro próximo
  isRead?: boolean; // Indica se já foi lido (baseado no localStorage/contexto)
  value?: number; // Valor da despesa (opcional)
}
// --- Fim dos Tipos ---

export function NotificationsPopover() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // Loading para buscar *detalhes*
  const [fetchedDespesas, setFetchedDespesas] = useState<ClientDespesa[]>([]); // Estado para guardar detalhes
  const { toast } = useToast();
  const router = useRouter();

  // --- Usando o Contexto de Notificação ---
  const {
      unreadCount, // Contagem não lida vinda do contexto
      isLoading: isLoadingCount, // Status de loading da contagem (do contexto)
      markAsRead, // Função para marcar como lido (do contexto)
      markAllAsRead, // Função para marcar todos como lidos (do contexto)
      readIds // Estado Set<string> dos IDs lidos (do contexto)
  } = useNotifications();
  // --- Fim do uso do Contexto ---

  // Fetch DETALHES das despesas relevantes QUANDO o popover é aberto
  useEffect(() => {
    let isMounted = true;
    async function fetchNotificationDetails() {
      if (!popoverOpen) {
        setFetchedDespesas([]);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const todayStart = startOfDay(new Date());
        const nextWeekEnd = endOfDay(addDays(todayStart, 7));

        // Fetch Pendente and A vencer statuses
        const params = new URLSearchParams({
            status: 'Pendente',
            limit: '20' // Limit details fetched
        });
        params.append('status', 'A vencer');


        // *** THE API CALL THAT WAS FAILING ***
        // This should now work because the API endpoint schema is fixed.
        const response = await fetch(`/api/despesas?${params.toString()}`);
        if (!response.ok) {
             // Log the status for more context
             console.error(`[NotificationsPopover] API Error Status: ${response.status}`);
             const errorBody = await response.text(); // Get raw text in case JSON parse fails
             console.error(`[NotificationsPopover] API Error Body: ${errorBody}`);
             // Try parsing as JSON, but fallback to text
             let errorMessage = "Falha ao buscar detalhes das notificações";
             try {
                 const errorData = JSON.parse(errorBody);
                 errorMessage = errorData.error || errorData.details || errorMessage;
             } catch (parseError) {
                 // Use the raw text if JSON parsing fails
                 errorMessage = errorBody || errorMessage;
             }
             throw new Error(errorMessage);
         }

        const data = await response.json();
        if (isMounted) {
           const relevantDespesas = (data.despesas || []).filter((d: ClientDespesa) => {
               try {
                   const dueDate = parseISO(d.dueDate);
                   return !isNaN(dueDate.getTime()) && (dueDate < todayStart || (dueDate >= todayStart && dueDate <= nextWeekEnd));
               } catch (e) {
                   console.warn(`[NotificationsPopover] Invalid dueDate for despesa ${d._id}: ${d.dueDate}`);
                   return false;
               }
           });
           setFetchedDespesas(relevantDespesas);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Erro ao buscar detalhes das notificações:", error);
          toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar detalhes das notificações." });
          setFetchedDespesas([]);
        }
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    }

    fetchNotificationDetails();
    return () => { isMounted = false };
  }, [popoverOpen, toast]);

   const notificationItems = useMemo((): NotificationItem[] => {
    const now = new Date();
    return fetchedDespesas
        .map((despesa): NotificationItem | null => {
            try {
                const dueDate = parseISO(despesa.dueDate);
                if (isNaN(dueDate.getTime())) return null;

                const isDueToday = isToday(dueDate);
                const isBeforeToday = dueDate < startOfDay(now);
                const isUpcoming = !isDueToday && !isBeforeToday;
                const isOverdue = isBeforeToday;

                let relativeDate = '';
                if (isDueToday) { relativeDate = 'Vence hoje'; }
                else if (isUpcoming) { relativeDate = `Vence ${formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true })}`; }
                else { relativeDate = `Atrasado ${formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true }).replace('há ','')}`; }

                return {
                    id: despesa._id,
                    title: despesa.description,
                    description: `Em: ${despesa.empreendimento?.name || 'N/A'}`, // Safe access
                    relativeDate: relativeDate,
                    href: `/dashboard/despesas/${despesa._id}`,
                    isOverdue: isOverdue,
                    isUpcoming: isUpcoming || isDueToday,
                    isRead: readIds.has(despesa._id),
                    value: despesa.value,
                };
            } catch (e) {
                console.warn(`[NotificationsPopover] Error processing despesa ${despesa._id}:`, e);
                return null;
            }
        })
        .filter((item): item is NotificationItem => item !== null)
        .sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            const dateA = parseISO(fetchedDespesas.find(d=>d._id === a.id)?.dueDate || '');
            const dateB = parseISO(fetchedDespesas.find(d=>d._id === b.id)?.dueDate || '');
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0; // Handle invalid dates
            if (isToday(dateA) && !isToday(dateB)) return -1;
            if (!isToday(dateA) && isToday(dateB)) return 1;
            return dateA.getTime() - dateB.getTime();
        });
    }, [fetchedDespesas, readIds]);

   const unreadItems = useMemo(() => notificationItems.filter(n => !n.isRead), [notificationItems]);

  const handleMarkAsReadClick = (id: string, href: string) => {
    markAsRead(id);
    setPopoverOpen(false);
    router.push(href);
  };

  const handleMarkAllAsReadClick = () => {
    const idsToMark = unreadItems.map(n => n.id);
    if (idsToMark.length > 0) {
        markAllAsRead(idsToMark);
        toast({ title: "Notificações lidas", description: "Marcadas como lidas." });
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
         <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações (${unreadCount} não lidas)`}>
           <Bell className="h-5 w-5" />
           <AnimatePresence>
             {unreadCount > 0 && !isLoadingCount && (
               <motion.span
                 key="unread-badge-popover-trigger"
                 initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                 transition={{ type: "spring", stiffness: 500, damping: 30 }}
                 className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
               >
                 {unreadCount > 9 ? '9+' : unreadCount}
               </motion.span>
             )}
           </AnimatePresence>
           {isLoadingCount && (
               <span className="absolute top-0 right-0 h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
               </span>
            )}
         </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 shadow-xl border border-border" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/80">
          <h3 className="font-semibold text-sm text-foreground">Notificações</h3>
          {unreadItems.length > 0 && (
            <Button variant="link" size="sm" className="h-auto text-xs px-2 py-0 text-primary hover:text-primary/80" onClick={handleMarkAllAsReadClick}>
              Marcar {unreadItems.length > 1 ? 'todas' : 'como'} lida(s)
            </Button>
          )}
        </div>

        {isLoadingDetails ? (
          <div className="p-4 space-y-3 max-h-[300px] overflow-hidden">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 items-center animate-pulse">
                    <Skeleton className="h-5 w-5 flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-2/3" />
                    </div>
                    <Skeleton className="h-2 w-2 rounded-full flex-shrink-0" />
                </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <AnimatePresence initial={false}>
              {notificationItems.length > 0 ? (
                notificationItems.map((notification) => (
                  <motion.div
                    key={notification.id}
                    layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={cn( "relative block p-3 border-b border-border/50 transition-colors hover:bg-muted/50 cursor-pointer", !notification.isRead && "bg-primary/5" )}
                    onClick={() => handleMarkAsReadClick(notification.id, notification.href)}
                    role="link" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleMarkAsReadClick(notification.id, notification.href)}
                    aria-label={`Notificação: ${notification.title}, ${notification.relativeDate}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-1 flex-shrink-0", notification.isOverdue ? "text-destructive" : "text-amber-600")}>
                        {notification.isOverdue ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <p className={cn("text-sm leading-snug truncate", !notification.isRead ? "font-semibold" : "font-medium")} title={notification.title}>
                            {notification.title}
                            {notification.value !== undefined && ( <span className="ml-1.5 text-xs font-normal text-muted-foreground"> (R$ {notification.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}) </span> )}
                        </p>
                        <p className="text-xs text-muted-foreground">{notification.relativeDate}</p>
                        <p className="text-xs text-muted-foreground truncate" title={notification.description}>{notification.description}</p>
                      </div>
                       {!notification.isRead && ( <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" aria-hidden="true"></div> )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                    <Bell className="mx-auto h-8 w-8 mb-2 opacity-50"/>
                    Nenhuma notificação relevante.
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        <Separator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full h-8 text-sm" asChild>
            <Link href="/dashboard/despesas?status=Pendente&status=A%20vencer">
                Ver Todas Pendentes
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}