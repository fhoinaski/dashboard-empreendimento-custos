// components/dashboard/notifications-popover.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow, parseISO, isToday, startOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/contexts/notification-context";
import { trpc } from "@/lib/trpc/client";
import type { ClientDespesa } from "@/lib/trpc/types";
import type { DespesaFilterParams, DespesaStatus } from "@/lib/trpc/types";

// Interface for notification items
interface NotificationItem {
  id: string;
  title: string;
  description: string;
  relativeDate: string;
  href: string;
  isOverdue: boolean;
  isUpcoming: boolean;
  isRead?: boolean;
  value?: number;
  status?: DespesaStatus | ClientDespesa["approvalStatus"];
  dateToSort: Date;
}

export function NotificationsPopover() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { unreadCount, isLoading: isLoadingCount, markAsRead, markAllAsRead, readIds } = useNotifications();

  // tRPC query to fetch relevant despesas
  const { data, isLoading: isLoadingDetails, error } = trpc.despesas.getAll.useQuery(
    {
      limit: 30,
      page: 1,
      status: ["Pendente", "A vencer", "Rejeitado"] as DespesaStatus[],
      sortBy: "createdAt",
      sortOrder: "desc",
    } satisfies DespesaFilterParams,
    {
      enabled: popoverOpen,
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    }
  );

  const fetchedDespesas = data?.despesas ?? [];

  // Handle errors via useEffect
  useEffect(() => {
    if (error) {
      console.error("[NotificationsPopover] tRPC Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar notificações.",
      });
    }
  }, [error, toast]);

  // Process despesas into notification items
  const notificationItems = useMemo((): NotificationItem[] => {
    const now = new Date();
    const todayStart = startOfDay(now);

    return fetchedDespesas
      .map((despesa: ClientDespesa): NotificationItem | null => {
        try {
          const dueDate = despesa.dueDate ? parseISO(despesa.dueDate) : null;
          const createdAtDate = despesa.createdAt ? parseISO(despesa.createdAt) : new Date(0);

          if (!dueDate && despesa.status === "A vencer") return null;

          let relativeDate = "";
          let isOverdue = false;
          let isUpcoming = false;
          let dateToSort = createdAtDate;
          const displayStatus = despesa.approvalStatus === "Rejeitado" ? "Rejeitado" : despesa.status;

          if (dueDate && isValid(dueDate)) {
            const isDueToday = isToday(dueDate);
            const isBeforeToday = dueDate < todayStart;

            if (displayStatus === "A vencer") {
              dateToSort = dueDate;
              isOverdue = isBeforeToday;
              isUpcoming = !isOverdue;
              relativeDate = isDueToday
                ? "Vence hoje"
                : isUpcoming
                ? `Vence ${formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true })}`
                : `Atrasado ${formatDistanceToNow(dueDate, { locale: ptBR, addSuffix: true }).replace("há ", "")}`;
            } else if (displayStatus === "Pendente" || displayStatus === "Rejeitado") {
              dateToSort = createdAtDate;
              relativeDate = `Registrado ${formatDistanceToNow(createdAtDate, { locale: ptBR, addSuffix: true })}`;
              isOverdue = displayStatus === "Rejeitado";
            } else {
              relativeDate = `Status: ${displayStatus}`;
            }
          } else if (displayStatus === "Pendente" || displayStatus === "Rejeitado") {
            dateToSort = createdAtDate;
            relativeDate = `Registrado ${formatDistanceToNow(createdAtDate, { locale: ptBR, addSuffix: true })}`;
            isOverdue = displayStatus === "Rejeitado";
          } else {
            return null;
          }

          return {
            id: despesa._id,
            title: despesa.description,
            description: `Em: ${despesa.empreendimento?.name || "N/A"} (${displayStatus})`,
            relativeDate,
            href: `/dashboard/despesas/${despesa._id}`,
            isOverdue,
            isUpcoming,
            isRead: readIds.has(despesa._id),
            value: despesa.value,
            status: displayStatus,
            dateToSort,
          };
        } catch (e) {
          console.warn(`[NotificationsPopover] Error processing despesa ${despesa._id}:`, e);
          return null;
        }
      })
      .filter((item): item is NotificationItem => item !== null)
      .sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;

        const getSortOrder = (status?: string): number => {
          if (status === "Rejeitado") return 1;
          if (status === "A vencer") return 2;
          if (status === "Pendente") return 3;
          return 4;
        };

        const orderA = getSortOrder(a.status);
        const orderB = getSortOrder(b.status);

        if (orderA !== orderB) return orderA - orderB;

        const timeA = a.dateToSort.getTime();
        const timeB = b.dateToSort.getTime();
        if (isNaN(timeA) || isNaN(timeB)) return 0;

        return a.status === "Pendente" ? timeB - timeA : timeA - timeB;
      });
  }, [fetchedDespesas, readIds]);

  const unreadItems = useMemo(() => notificationItems.filter((n) => !n.isRead), [notificationItems]);
  const displayUnreadCount = unreadCount;

  const handleMarkAsReadClick = (id: string, href: string) => {
    markAsRead(id);
    setPopoverOpen(false);
    router.push(href);
  };

  const handleMarkAllAsReadClick = () => {
    const idsToMark = unreadItems.map((n) => n.id);
    if (idsToMark.length > 0) {
      markAllAsRead(idsToMark);
      toast({ title: "Notificações lidas", description: "Marcadas como lidas localmente." });
    }
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações (${displayUnreadCount} não lidas)`}>
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {displayUnreadCount > 0 && !isLoadingCount && (
              <motion.span
                key="unread-badge-popover-trigger"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              >
                {displayUnreadCount > 9 ? "9+" : displayUnreadCount}
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
            <Button
              variant="link"
              size="sm"
              className="h-auto text-xs px-2 py-0 text-primary hover:text-primary/80"
              onClick={handleMarkAllAsReadClick}
            >
              Marcar {unreadItems.length > 1 ? "todas" : "como"} lida(s)
            </Button>
          )}
        </div>

        {isLoadingDetails ? (
          <div className="p-4 space-y-3 max-h-[300px] overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 items-center animate-pulse">
                <Skeleton className="h-5 w-5 flex-shrink-0 rounded-full" />
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
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={cn(
                      "relative block p-3 border-b border-border/50 transition-colors hover:bg-muted/50 cursor-pointer",
                      !notification.isRead && "bg-primary/5"
                    )}
                    onClick={() => handleMarkAsReadClick(notification.id, notification.href)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleMarkAsReadClick(notification.id, notification.href)}
                    aria-label={`Notificação: ${notification.title}, ${notification.relativeDate}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1 flex-shrink-0",
                          notification.isOverdue ? "text-destructive" : notification.isUpcoming ? "text-amber-600" : "text-muted-foreground"
                        )}
                      >
                        {notification.status === "Rejeitado" || notification.isOverdue ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <p
                          className={cn("text-sm leading-snug truncate", !notification.isRead ? "font-semibold" : "font-medium")}
                          title={notification.title}
                        >
                          {notification.title}
                          {notification.value !== undefined && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              (R$ {notification.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{notification.relativeDate}</p>
                        <p className="text-xs text-muted-foreground truncate" title={notification.description}>
                          {notification.description}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" aria-hidden="true"></div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  Nenhuma notificação relevante.
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        <Separator />
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full h-8 text-sm" asChild>
            <Link href="/dashboard/despesas?status=Pendente&status=A%20vencer">Ver Todas Pendentes/A Vencer</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}