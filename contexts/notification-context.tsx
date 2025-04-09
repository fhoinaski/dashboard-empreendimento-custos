// contexts/notification-context.tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react'; // Added useMemo
import { trpc } from '@/lib/trpc/client';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';
import { TRPCClientErrorLike } from '@trpc/client';
import { AppRouter } from '@/server/api/root';

// Define the structure of a notification as returned by getSummary
interface ClientNotification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  destinatarioId?: string;
  destinatarioName?: string;
  empreendimentoId?: string;
  empreendimentoName?: string;
  read: boolean; // Server-side read status
  createdAt: string;
}

// *** Interface MUST include readIds and markAllAsRead ***
interface NotificationContextType {
  notifications: ClientNotification[];
  unreadCount: number; // This will be the client-side count
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  readIds: Set<string>; // <<<<< MUST BE DECLARED HERE
  markAllAsRead: (ids: string[]) => Promise<void>; // <<<<< MUST BE DECLARED HERE
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'readNotificationIds';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  // State for locally read IDs
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const utils = trpc.useContext();

  // Load read IDs from localStorage on mount
  useEffect(() => {
    try {
        const storedIds = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedIds) {
            setReadIds(new Set(JSON.parse(storedIds)));
            console.log("[NotifCtx] Loaded read IDs from localStorage:", JSON.parse(storedIds).length);
        } else {
            console.log("[NotifCtx] No read IDs found in localStorage.");
        }
    } catch (error) {
       console.error("[NotifCtx] Error loading read IDs from localStorage:", error);
       localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Save read IDs to localStorage when they change
  useEffect(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(readIds)));
        // console.log("[NotifCtx] Saved read IDs to localStorage:", readIds.size);
      } catch (error) {
         console.error("[NotifCtx] Error saving read IDs to localStorage:", error);
      }
  }, [readIds]);


  // Query for server-side notification summary
  const summaryQuery = trpc.notifications.getSummary.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 1000 * 60, // 1 min
    refetchInterval: 60000, // Refetch every minute
  });

  // Update local state when server data changes
  useEffect(() => {
    if (summaryQuery.data) {
      const serverNotifications = summaryQuery.data.notifications || [];
      const serverUnread = summaryQuery.data.unreadCount || 0;
      setNotifications(serverNotifications);
      setServerUnreadCount(serverUnread);
      console.log(`[NotifCtx] Server fetch: ${serverNotifications.length} notifs, ${serverUnread} unread (server).`);
    }
  }, [summaryQuery.data]);

  // Handle query errors
  useEffect(() => {
    if (summaryQuery.error) {
      console.error("Erro ao buscar notificações:", summaryQuery.error);
      // toast({ variant: "destructive", title: "Erro Notif.", description: "Falha ao buscar." });
    }
  }, [summaryQuery.error, toast]);

  // Calculate CLIENT-SIDE unread count
  const clientUnreadCount = useMemo(() => {
      // Filter the *server's* list against the *local* read IDs
      return notifications.filter(n => !readIds.has(n._id)).length;
  }, [notifications, readIds]);

  // Mutation to mark as read on the server
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: (_, variables) => {
      console.log(`[NotifCtx] Server marked ${variables.id} as read.`);
    },
    onError: (err, variables) => {
      toast({
        title: "Erro no Servidor",
        description: `Não foi possível marcar notificação ${variables.id} como lida: ${err.message}`,
        variant: "destructive",
      });
    }
  });

  // Action: Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
      setReadIds(prev => new Set(prev).add(id));
      console.log(`[NotifCtx] Locally marked ${id} as read.`);
      const notificationExists = notifications.some(n => n._id === id);
      if (notificationExists) {
          try { await markAsReadMutation.mutateAsync({ id, lida: true }); } catch (e) { /* Error handled by onError */ }
      } else { console.warn(`[NotifCtx] markAsRead called for ID ${id} not found.`); }
  }, [markAsReadMutation, notifications]);

  // Action: Mark ALL currently unread notifications as read (CLIENT-SIDE)
   const markAllAsRead = useCallback(async (idsToMark: string[]) => {
       setReadIds(prev => {
           const newSet = new Set(prev);
           idsToMark.forEach(id => newSet.add(id));
           return newSet;
       });
       console.log(`[NotifCtx] Locally marked ${idsToMark.length} notifications as read.`);
       // Optional TODO: Implement a batch markAsRead mutation on the backend if needed
   }, []);


  // Polling logic
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      utils.notifications.getSummary.invalidate();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, utils]);


  // *** Value object MUST include readIds and markAllAsRead ***
  const value: NotificationContextType = {
    notifications, // Full list from server
    unreadCount: clientUnreadCount, // Use client-side count
    isLoading: summaryQuery.isLoading || sessionStatus === 'loading',
    markAsRead,
    readIds, // <<<<< MUST BE PROVIDED HERE
    markAllAsRead, // <<<<< MUST BE PROVIDED HERE
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// useNotifications hook remains the same
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}