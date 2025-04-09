import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Schemas para validação de dados de notificações (tRPC)
 */

// --- Enums ---
export const notificationTypeSchema = z.enum(['info', 'warning', 'error', 'success']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

// --- Schemas de Input ---

// Schema para criação de notificação (uso interno do sistema)
export const createNotificationSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório"),
  mensagem: z.string().trim().min(1, "Mensagem é obrigatória"),
  tipo: notificationTypeSchema,
  destinatarioId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de destinatário inválido",
  }).optional(),
  empreendimentoId: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de empreendimento inválido",
  }).optional(),
});
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

// Schema para marcar notificação como lida/não lida
export const updateNotificationSchema = z.object({
  id: z.string().refine((val) => mongoose.isValidObjectId(val), {
    message: "ID de notificação inválido",
  }),
  lida: z.boolean(),
});
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;

// --- Schemas de Output ---

// Schema para a resposta de uma notificação individual (populada)
export const notificationResponseSchema = z.object({
    _id: z.string(),
    title: z.string(), // Mapeado de 'titulo'
    message: z.string(), // Mapeado de 'mensagem'
    type: notificationTypeSchema, // Mapeado de 'tipo'
    destinatarioId: z.string().optional(),
    destinatarioName: z.string().optional(), // Adicionado se populado
    empreendimentoId: z.string().optional(),
    empreendimentoName: z.string().optional(), // Adicionado se populado
    read: z.boolean(), // Mapeado de 'lida'
    createdAt: z.string().datetime(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;


// Schema para a resposta do resumo de notificações (usado por getSummary)
export const notificationSummaryResponseSchema = z.object({
    notifications: z.array(notificationResponseSchema),
    unreadCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
});
export type NotificationSummaryResponse = z.infer<typeof notificationSummaryResponseSchema>;