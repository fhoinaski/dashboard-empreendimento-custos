import { trpc } from '@/lib/trpc/client';
import { useCallback, useEffect } from 'react'; // Import useEffect
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
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { toast } = useToast();
  const utils = trpc.useContext();

  // Consultas
  // FIX 1: Removed onError from useQuery options
  const summaryQuery = trpc.notifications.getSummary.useQuery(undefined, {
    staleTime: 1000 * 60, // 1 minuto
    refetchInterval: 60000,
    // onError was here - REMOVED
  });

  // Optional: useEffect to handle query errors
  useEffect(() => {
    if (summaryQuery.error) {
      console.error("Erro ao buscar sumário de notificações:", summaryQuery.error);
      toast({
        title: "Erro ao carregar notificações",
        description: "Não foi possível buscar as notificações.",
        variant: "destructive",
      });
    }
  }, [summaryQuery.error, toast]);

  // Mutações
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: (_, variables) => {
      toast({
          title: "Notificação lida",
          description: "A notificação foi marcada como lida.",
      });
      utils.notifications.getSummary.invalidate();
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => {
      toast({
        title: "Erro ao marcar notificação como lida",
        description: error.message,
        variant: "destructive",
      });
       utils.notifications.getSummary.invalidate(); // Refetch on error too
    },
  });

  // Funções de ação
  const markAsRead = useCallback(async (id: string) => {
    return markAsReadMutation.mutateAsync({ id, lida: true });
  }, [markAsReadMutation]);

  return {
    // Dados e estado
    notifications: summaryQuery.data?.notifications || [] as ClientNotification[],
    unreadCount: summaryQuery.data?.unreadCount || 0,

    // Estado de carregamento
    isLoading: summaryQuery.isLoading,
    isMarkingAsRead: markAsReadMutation.isPending,

    // Funções de ação
    markAsRead,
  };
}