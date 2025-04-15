// ============================================================
// START OF REFACTORED FILE: lib/db/models.ts
// ============================================================
import mongoose, { Schema, Document, Types, Model } from 'mongoose';

// --- Interfaces ---
interface Attachment {
  _id?: Types.ObjectId;
  fileId?: string;
  name?: string;
  url?: string;
}

export interface DespesaDocument extends Document {
  description: string;
  value: number;
  date: Date;
  dueDate: Date;
  status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado';
  empreendimento: Types.ObjectId;
  category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
  paymentMethod?: string;
  notes?: string;
  attachments?: Attachment[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado'; // Keep required
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'user';
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences?: {
    emailDespesasVencer?: boolean;
    emailDocumentosNovos?: boolean;
    emailRelatoriosSemanais?: boolean;
    systemDespesasVencer?: boolean;
    systemDocumentosNovos?: boolean;
    systemEventosCalendario?: boolean;
    antecedenciaVencimento?: number;
  };
  preferences?: {
    language?: string;
    dateFormat?: string;
    currency?: string;
  };
  assignedEmpreendimentos?: Types.ObjectId[];
}

export interface EmpreendimentoDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  address: string;
  type: 'Residencial' | 'Comercial' | 'Misto' | 'Industrial';
  status: 'Planejamento' | 'Em andamento' | 'Concluído';
  totalUnits: number;
  soldUnits: number;
  startDate: Date;
  endDate: Date;
  description?: string;
  responsiblePerson: string;
  contactEmail: string;
  contactPhone: string;
  image?: string;
  folderId?: string;
  sheetId?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date; // Ensure this exists due to timestamps: true
}

export interface DocumentoDocument extends Document {
  name: string;
  type: string;
  empreendimento: Types.ObjectId | EmpreendimentoDocument;
  category: string;
  fileId: string;
  url?: string;
  createdBy?: Types.ObjectId | UserDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDocument extends Document {
  _id: Types.ObjectId;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  destinatarioId?: Types.ObjectId;
  empreendimentoId?: Types.ObjectId;
  lida: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettingsDocument extends Document {
  _id: string;
  companyName?: string | null;
  cnpj?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl?: string | null;
  googleApiKeyEncrypted?: string | null;
  awsApiKeyEncrypted?: string | null;
  awsSecretKeyEncrypted?: string | null;
  updatedAt: Date;
}

// --- Schemas ---

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, minlength: 2 },
  email: { type: String, required: true, unique: true, match: [/.+\@.+\..+/, 'Email inválido'], index: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'manager', 'user'] as const, default: 'user' },
  avatarUrl: { type: String, default: '' },
  notificationPreferences: {
    emailDespesasVencer: { type: Boolean, default: true },
    emailDocumentosNovos: { type: Boolean, default: true },
    emailRelatoriosSemanais: { type: Boolean, default: false },
    systemDespesasVencer: { type: Boolean, default: true },
    systemDocumentosNovos: { type: Boolean, default: true },
    systemEventosCalendario: { type: Boolean, default: true },
    antecedenciaVencimento: { type: Number, default: 3, min: 0 },
  },
  preferences: {
    language: { type: String, default: 'pt-BR' },
    dateFormat: { type: String, default: 'dd/MM/yyyy' },
    currency: { type: String, default: 'BRL' },
  },
  assignedEmpreendimentos: {
    type: [{ type: Schema.Types.ObjectId, ref: 'Empreendimento' }],
    default: [],
  },
}, { timestamps: true });

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
  contactEmail: { type: String, required: true, match: [/.+\@.+\..+/, 'Email inválido'] },
  contactPhone: { type: String, required: true },
  image: { type: String, default: '' },
  folderId: { type: String, default: '' },
  sheetId: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true }); // *** Ensure timestamps: true is here ***

const despesaSchema = new Schema<DespesaDocument>({
  description: { type: String, required: true, minlength: 2 },
  value: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['Pago', 'Pendente', 'A vencer', 'Rejeitado'] as const, default: 'Pendente' },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true },
  category: { type: String, enum: ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'] as const, required: true },
  paymentMethod: { type: String, default: '' },
  notes: { type: String, default: '' },
  attachments: [{ _id: false, fileId: String, name: String, url: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // *** FIX: Add default value for approvalStatus ***
  approvalStatus: {
      type: String,
      enum: ['Pendente', 'Aprovado', 'Rejeitado'] as const,
      default: 'Pendente', // Set default
      required: true // Keep required
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true }); // *** Ensure timestamps: true is here ***

// Add indexes...
despesaSchema.index({ empreendimento: 1 });
despesaSchema.index({ dueDate: 1 });
despesaSchema.index({ dueDate: -1 });
// ... other indexes ...

const documentoSchema = new Schema<DocumentoDocument>({
  name: { type: String, required: true, minlength: 2 },
  type: { type: String, required: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true, index: true },
  category: { type: String, default: 'Outros', index: true },
  fileId: { type: String, required: true },
  url: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

documentoSchema.index({ empreendimento: 1, category: 1 });

const appSettingsSchema = new Schema<AppSettingsDocument>({
  _id: { type: String, default: 'global_settings' },
  companyName: { type: String },
  cnpj: { type: String },
  companyAddress: { type: String },
  companyPhone: { type: String },
  companyEmail: { type: String },
  logoUrl: { type: String },
  googleApiKeyEncrypted: { type: String },
  awsApiKeyEncrypted: { type: String },
  awsSecretKeyEncrypted: { type: String },
  // No 'updatedAt' needed here, managed by timestamps option
}, { _id: false, timestamps: { createdAt: false, updatedAt: true } });

const notificationSchema = new Schema<NotificationDocument>({
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  tipo: { type: String, enum: ['info', 'warning', 'error', 'success'] as const, required: true },
  destinatarioId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  empreendimentoId: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: false },
  lida: { type: Boolean, default: false },
}, { timestamps: true });

// ============================================================
// END OF REFACTORED FILE: lib/db/models.ts
// ============================================================
export {};