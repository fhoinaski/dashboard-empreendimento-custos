import mongoose, { Schema, Document, Types } from 'mongoose';
import { z } from 'zod';
import { EmpreendimentoDocument } from '@/lib/db/models';

// --- TIPOS ---
export type EmpreendimentoType = 'Residencial' | 'Comercial' | 'Misto' | 'Industrial';
export type EmpreendimentoStatus = 'Planejamento' | 'Em andamento' | 'Concluído';
export type DespesaStatus = 'Aberta' | 'Paga' | 'Atrasada';
export type NotificacaoTipo = 'info' | 'warning' | 'error' | 'success';
export type UserRole = 'admin' | 'user';


// --- INTERFACES ---

export interface DespesaDocument extends Document {
  description: string;
  value: number;
  date: Date;
  dueDate: Date;
  status: DespesaStatus;
  empreendimento: Types.ObjectId;
}

export interface NotificationDocument extends Document {
  destinatarioId?: Types.ObjectId;
  empreendimentoId?: Types.ObjectId;
  titulo: string;
  mensagem: string;
  tipo: NotificacaoTipo;
  lida: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument extends Document {
  name: string;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  hashedPassword?: string;
  role: UserRole;
  avatarUrl?: string;
  notificationPreferences?: {
  plan: 'free' | 'plus' | 'pro';
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  preferences?: {
    darkMode: boolean;
    language: string;
    currency: string
  }
  assignedEmpreendimentos?: Types.ObjectId[]; // Array de IDs de Empreendimento
}

// --- SCHEMAS ---

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Date, default: null },
  image: { type: String, default: null },
  hashedPassword: { type: String },
  role: { type: String, enum: ['admin', 'user'] as const, default: 'user', required: true },
  plan: { type: String, enum: ['free', 'plus', 'pro'] as const, default: 'free', required: true },
  avatarUrl: { type: String, default: '' },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
  },
  preferences: {
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: 'pt-BR' },
    currency: { type: String, default: 'BRL' },
  },
  assignedEmpreendimentos: [{ type: Schema.Types.ObjectId, ref: 'Empreendimento' }], // Referência ao modelo Empreendimento
}, {
  timestamps: true // createdAt e updatedAt
});

const empreendimentoSchema = new Schema<EmpreendimentoDocument>({
  name: { type: String, required: true, minlength: 2, index: true },
  address: { type: String, required: true },
  type: { type: String, enum: ['Residencial', 'Comercial', 'Misto', 'Industrial'] as const, required: true, index: true },
  status: { type: String, enum: ['Planejamento', 'Em andamento', 'Concluído'] as const, required: true, index: true },
  totalUnits: { type: Number, required: true, min: 0 },
  soldUnits: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String, default: '' },
  responsiblePerson: { type: String, required: true },
  contactEmail: { type: String, required: true, match: [/.+@.+..+/, 'Email inválido'] },
  contactPhone: { type: String, required: true },
  image: { type: String, default: '' },
  folderId: { type: String, default: '' },
  sheetId: { type: String, default: '' },
}, {
  timestamps: true // createdAt e updatedAt
});


const despesaSchema = new Schema<DespesaDocument>({
  description: { type: String, required: true },
  value: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['Aberta', 'Paga', 'Atrasada'] as const, required: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true },
}, {
  timestamps: true
});

const notificationSchema = new Schema<NotificationDocument>({
  destinatarioId: { type: Schema.Types.ObjectId, ref: 'User' },
  empreendimentoId: { type: Schema.Types.ObjectId, ref: 'Empreendimento' },
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  tipo: { type: String, enum: ['info', 'warning', 'error', 'success'] as const, required: true },
  lida: { type: Boolean, default: false, required: true },
}, {
  timestamps: true
});

// --- MODELS ---

export const User = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema);
export const Empreendimento = mongoose.models.Empreendimento || mongoose.model<EmpreendimentoDocument>('Empreendimento', empreendimentoSchema);
export const Despesa = mongoose.models.Despesa || mongoose.model<DespesaDocument>('Despesa', despesaSchema);
export const Notification = mongoose.models.Notification || mongoose.model<NotificationDocument>('Notification', notificationSchema);

export const UserModel = User