import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    createNotificationSchema,
    updateNotificationSchema,
    notificationSummaryResponseSchema // Import summary response schema
} from '../schemas/notifications';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento, Notification, NotificationDocument } from '../../db/schema';
import mongoose, { Types, FilterQuery, Model, Schema } from 'mongoose';


// Interface for Notification populada com lean (matching schema)
interface PopulatedLeanNotification extends Omit<NotificationDocument, 'destinatarioId' | 'empreendimentoId'> {
  _id: Types.ObjectId;
  destinatarioId?: { _id: Types.ObjectId; name: string } | null;
  empreendimentoId?: { _id: Types.ObjectId; name: string } | null;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  lida: boolean;
  createdAt: Date;
  updatedAt: Date;
}




/**
 * Roteador para notificações
 * Gerencia rotas relacionadas às notificações do sistema
 */
export const notificationsRouter = router({
  // Obter resumo de notificações do usuário (GET /api/notifications/summary)
  getSummary: protectedProcedure
    .output(notificationSummaryResponseSchema) // Validate output
    .query(async ({ ctx }) => {
      console.log(`[tRPC notifications.getSummary] Buscando para usuário: ${ctx.user.id}`);
      try {
        await connectToDatabase();
        const userId = new Types.ObjectId(ctx.user.id);

        // Base filter: unread notifications for the user or global ones
        const filter: FilterQuery<NotificationDocument> = {
          $or: [
            { destinatarioId: userId },
            { destinatarioId: { $exists: false } }, // Notificações globais
          ],
           // lida: false, // Fetch only unread for summary count? Or all recent? Let's fetch recent unread.
        };

        console.log("[tRPC notifications.getSummary] Filtro MongoDB:", JSON.stringify(filter));
        

        // Fetch recent notifications (e.g., last 50) and count unread
        const [notifications, unreadCount, totalCount] = await Promise.all([
             Notification.find(filter) // Filter might need adjustment based on desired summary (e.g., only unread)
               .sort({ createdAt: -1 })
               .limit(50) // Limit the number returned
               .populate<{ destinatarioId: { _id: Types.ObjectId; name: string } | null }>('destinatarioId', 'name _id')
               .populate<{ empreendimentoId: { _id: Types.ObjectId; name: string } | null }>('empreendimentoId', 'name _id')
               .lean<PopulatedLeanNotification[]>(), // Use the defined interface
             Notification.countDocuments({ ...filter, lida: false }), // Count only unread ones matching filter
             Notification.countDocuments(filter) // Count all matching filter
         ]);
         console.log(`[tRPC notifications.getSummary] Notificações recentes: ${notifications.length}, Não lidas: ${unreadCount}, Total (filtrado): ${totalCount}`);

        const clientNotifications = notifications.map((notif) => ({
          _id: notif._id.toString(),
          title: notif.titulo,
          message: notif.mensagem,
          type: notif.tipo,
          destinatarioId: notif.destinatarioId?._id?.toString(),
          destinatarioName: notif.destinatarioId?.name,
          empreendimentoId: notif.empreendimentoId?._id?.toString(),
          empreendimentoName: notif.empreendimentoId?.name,
          read: notif.lida,
          createdAt: notif.createdAt.toISOString(),
        }));

        // Validate response structure
        return notificationSummaryResponseSchema.parse({
             notifications: clientNotifications,
             unreadCount,
             totalCount,
         });

      } catch (error) {
        console.error('[tRPC notifications.getSummary] Erro:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao buscar resumo de notificações',
        });
      }
    }),
    
  // Marcar notificação como lida/não lida
  markAsRead: protectedProcedure
    .input(updateNotificationSchema) // Uses schema { id: string, lida: boolean }
    .mutation(async ({ input, ctx }) => {
      console.log(`[tRPC notifications.markAsRead] ID: ${input.id}, Lida: ${input.lida}`);
      try {
        await connectToDatabase();
        const userId = new Types.ObjectId(ctx.user.id);

        // Find the notificatio
        const notification = await Notification.findById(input.id);
        if (!notification) {
           console.error(`[tRPC notifications.markAsRead] Notificação não encontrada: ${input.id}`);
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Notificação não encontrada' });
        }

        // Authorization check: User can only mark their own notifications or global ones?
        // For simplicity, let's assume users can only mark their specifically assigned notifications.
        // Global notifications might not be 'markable' in the same way.
        if (notification.destinatarioId && !notification.destinatarioId.equals(userId)) {
           console.warn(`[tRPC notifications.markAsRead] Usuário ${userId} tentando marcar notificação ${input.id} de outro usuário.`);
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para atualizar esta notificação' });
        }
         // If it's a global notification (no destinatarioId), allow anyone authenticated? Or only admins?
         // Let's assume anyone authenticated can dismiss a global one for themselves (but this state isn't stored per user here).
         // A better approach for global read status might need a separate UserNotificationRead collection.
         // For now, we only update if it's specifically assigned.

        if (notification.destinatarioId) {
            console.log(`[tRPC notifications.markAsRead] Atualizando notificação ${input.id} para lida=${input.lida}`);
            await Notification.findByIdAndUpdate(input.id, { lida: input.lida, updatedAt: new Date() });
        } else {
            // Cannot mark global notifications as read this way currently
             console.log(`[tRPC notifications.markAsRead] Ignorando marcação para notificação global ${input.id}.`);
            // Optionally, implement UserNotificationRead logic here
             return { success: true, message: 'Status de notificação global não alterado.' };
        }

        return {
          success: true,
          message: `Notificação marcada como ${input.lida ? 'lida' : 'não lida'}`,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC notifications.markAsRead] Erro:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao atualizar notificação',
        });
      }
    }),
    
  // Criar notificação (para uso interno do sistema/backend)
  // Should likely be an adminProcedure or restricted internal call
  // For now, keeping protectedProcedure but adding a check
  create: protectedProcedure // Or adminProcedure
    .input(createNotificationSchema)
    .mutation(async ({ input, ctx }) => {
       // Example RBAC check if kept as protectedProcedure
       if (ctx.user.role !== 'admin') { // Allow only admins to create manually for now
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem criar notificações manualmente.' });
       }
       console.log("[tRPC notifications.create] Input:", input);

      try {
        await connectToDatabase();

        // Convert IDs only if they exist
        const destinatarioObjectId = input.destinatarioId && mongoose.isValidObjectId(input.destinatarioId)
            ? new Types.ObjectId(input.destinatarioId)
            : undefined;
        const empreendimentoObjectId = input.empreendimentoId && mongoose.isValidObjectId(input.empreendimentoId)
            ? new Types.ObjectId(input.empreendimentoId)
            : undefined;

        // Validate referenced documents if IDs were provided
        if (destinatarioObjectId) {
            const userExists = await User.exists({ _id: destinatarioObjectId });   
            if (!userExists) throw new TRPCError({ code: 'BAD_REQUEST', message: `Destinatário não encontrado: ${input.destinatarioId}` });
        }
        if (empreendimentoObjectId) {
             const empExists = await Empreendimento.exists({ _id: empreendimentoObjectId });
             if (!empExists) throw new TRPCError({ code: 'BAD_REQUEST', message: `Empreendimento não encontrado: ${input.empreendimentoId}` });
        }

        const notificationData = {
          ...input,
          destinatarioId: destinatarioObjectId,
          empreendimentoId: empreendimentoObjectId,
        };
         console.log("[tRPC notifications.create] Dados para criação:", notificationData);

        const newNotification = await Notification.create(notificationData);
         console.log(`[tRPC notifications.create] Notificação criada com ID: ${newNotification._id}`);

        // Invalidate summary query for the specific user if targeted, or globally?
        if (destinatarioObjectId) {
             // Ideally, invalidate cache specific to that user if possible with tRPC utils
        } else {
            // No invalidation is performed for global notifications on server side
        }


        return {
          success: true,
          message: 'Notificação criada com sucesso',
          notification: { // Return minimal info
            id: newNotification._id.toString(),
            titulo: newNotification.titulo,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[tRPC notifications.create] Erro:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao criar notificação',
        });
      }
    }),
});

export type NotificationsRouter = typeof notificationsRouter;