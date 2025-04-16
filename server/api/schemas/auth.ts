import { z } from 'zod';
import mongoose from 'mongoose'; // Import Mongoose for ObjectId validation

/**
 * Schemas para validação de dados de usuários e autenticação (tRPC)
 * Usados por authRouter e usersRouter
 */

// --- Schemas de Preferências (Reutilizáveis) ---
export const notificationPreferencesSchema = z.object({
  emailDespesasVencer: z.boolean().default(true),
  emailDocumentosNovos: z.boolean().default(true),
  emailRelatoriosSemanais: z.boolean().default(false),
  systemDespesasVencer: z.boolean().default(true),
  systemDocumentosNovos: z.boolean().default(true),
  systemEventosCalendario: z.boolean().default(true),
  antecedenciaVencimento: z.number().int().min(0).default(3),
});

export const userPreferencesSchema = z.object({
  language: z.string().default('pt-BR'),
  dateFormat: z.string().default('dd/MM/yyyy'),
  currency: z.string().default('BRL'),
});

// --- Schemas de Input ---

// Schema para login (usado internamente pelo authorize do NextAuth)
export const loginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Schema para criação de usuário (usado por authRouter.register)
export const createUserSchema = z.object({
  name: z.string().trim().min(2, { message: 'O nome deve ter pelo menos 2 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres' }),
  plan: z.enum(['free', 'plus', 'pro'], {
    errorMap: () => ({ message: "Plano inválido" })
  }).default('free'),

  role: z.enum(['admin', 'manager', 'user'], {
    errorMap: () => ({ message: "Função inválida" })
  }),
  assignedEmpreendimentos: z.array(z.string())
    .refine((ids) => ids.every(id => mongoose.isValidObjectId(id)), {
        message: "Um ou mais IDs de empreendimento são inválidos",
    })
    .optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// Schema para atualização de usuário (usado por usersRouter.update)
export const updateUserSchema = z.object({
    plan: z.enum(['free', 'plus', 'pro'], {
      errorMap: () => ({ message: "Plano inválido" })
    }).optional(),
    name: z.string().trim().min(2, { message: 'O nome deve ter pelo menos 2 caracteres' }).optional(),
    role: z.enum(['admin', 'manager', 'user'], {
        errorMap: () => ({ message: "Função inválida" })
    }).optional(),
    assignedEmpreendimentos: z.array(z.string())
      .refine((ids) => ids.every(id => mongoose.isValidObjectId(id)), {
          message: "Um ou mais IDs de empreendimento são inválidos",
      })
      .optional(),
    // Password é atualizado em endpoint separado
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Schema para atualizar senha de OUTRO usuário (usado por usersRouter.updatePassword)
export const adminUpdatePasswordSchema = z.object({
    password: z.string().min(6, { message: 'A nova senha deve ter pelo menos 6 caracteres' }),
});
export type AdminUpdatePasswordInput = z.infer<typeof adminUpdatePasswordSchema>;

// --- Schemas de Output ---

// Schema para resposta de usuário (usado por vários endpoints)
export const userResponseSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'user']),
  avatarUrl: z.string().url().optional().nullable(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  preferences: userPreferencesSchema.optional(),
  assignedEmpreendimentos: z.array(z.object({ // Inclui o nome aqui para a lista de usuários
    _id: z.string(),
    name: z.string(),
  })).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

// Schema para a resposta da lista de usuários (usado por usersRouter.getAll)
export const userListResponseSchema = z.object({
    users: z.array(userResponseSchema),
    pagination: z.object({
        total: z.number().int().min(0),
        limit: z.number().int().positive(),
        page: z.number().int().positive(),
        pages: z.number().int().min(0),
        hasMore: z.boolean(),
    })
});
export type UserListResponse = z.infer<typeof userListResponseSchema>;