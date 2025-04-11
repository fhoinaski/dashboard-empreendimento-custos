// ============================================================
// FILE: lib/db/models.ts
// DESCRIPTION: Mongoose models and interfaces for the application
// ============================================================

import mongoose, { Schema, Document, Types, Model } from 'mongoose';

// --- Interfaces ---

// Tenant
export interface TenantDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: 'active' | 'pending' | 'suspended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Subscription
export interface SubscriptionDocument extends Document {
  tenantId: Types.ObjectId;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  price: number;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Billing History
export interface BillingHistoryDocument extends Document {
  tenantId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  amount: number;
  status: 'paid' | 'failed' | 'pending';
  method: 'credit_card' | 'pix' | 'boleto' | 'manual';
  stripeInvoiceId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// AppSettings
export interface AppSettingsDocument extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  companyName?: string | null;
  cnpj?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl?: string | null;
  googleApiKeyEncrypted?: string | null;
  awsApiKeyEncrypted?: string | null;
  awsSecretKeyEncrypted?: string | null;
  googleDriveEnabled: boolean;
  googleSheetsEnabled: boolean;
  googleServiceAccountJsonEncrypted?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Notification
export interface NotificationDocument extends Document {
  tenantId?: Types.ObjectId | null;
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

// Documento
export interface DocumentoDocument extends Document {
  tenantId: Types.ObjectId;
  name: string;
  type: string;
  empreendimento: Types.ObjectId;
  category: string;
  fileId: string;
  url?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Empreendimento
export interface EmpreendimentoDocument extends Document {
  tenantId: Types.ObjectId;
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
  updatedAt: Date;
}

// *** NEW: Define EmpreendimentoLeanPopulated for lean populated data ***
export interface EmpreendimentoLeanPopulated {
  _id: Types.ObjectId;
  name: string;
}

// Despesa
interface Attachment {
  _id?: Types.ObjectId;
  fileId?: string;
  name?: string;
  url?: string;
}

export interface DespesaDocument extends Document {
  tenantId: Types.ObjectId;
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
  approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationLogDocument extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  integration: 'GoogleDrive' | 'GoogleSheets' | 'S3' | 'Database' | 'Outro';
  action: 'UPLOAD' | 'DOWNLOAD' | 'SYNC' | 'CREATE_FOLDER' | 'DELETE' | 'GET_CONFIG' | 'UPDATE_SHEET' | 'BACKUP' | 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'REVIEW_EXPENSE' | 'DELETE_EXPENSE';
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  details: object | string;
  createdAt: Date;
  updatedAt: Date;
}

// User
export interface UserDocument extends Document {
  tenantId?: Types.ObjectId | null;
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'superadmin' | 'admin' | 'manager' | 'user';
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'trialing';
  avatarUrl?: string;
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
  assignedEmpreendimentos?: (Types.ObjectId | EmpreendimentoDocument)[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const tenantSchema = new Schema<TenantDocument>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, enum: ['active', 'pending', 'suspended', 'cancelled'], default: 'pending' },
}, { timestamps: true });
tenantSchema.index({ status: 1 });

const subscriptionSchema = new Schema<SubscriptionDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true, unique: true },
  plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['active', 'past_due', 'canceled', 'trialing'], required: true, index: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  renewalDate: { type: Date },
  stripeSubscriptionId: { type: String, index: true },
}, { timestamps: true });
subscriptionSchema.index({ tenantId: 1, status: 1 });

const billingHistorySchema = new Schema<BillingHistoryDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['paid', 'failed', 'pending'], required: true },
  method: { type: String, enum: ['credit_card', 'pix', 'boleto', 'manual'], required: true },
  stripeInvoiceId: { type: String, index: true },
  paidAt: { type: Date },
}, { timestamps: true });
billingHistorySchema.index({ tenantId: 1, createdAt: -1 });

const appSettingsSchema = new Schema<AppSettingsDocument>({
  _id: { type: Schema.Types.ObjectId, required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  companyName: { type: String, default: null },
  cnpj: { type: String, default: null },
  companyAddress: { type: String, default: null },
  companyPhone: { type: String, default: null },
  companyEmail: { type: String, default: null },
  logoUrl: { type: String, default: null },
  googleApiKeyEncrypted: { type: String, default: null },
  awsApiKeyEncrypted: { type: String, default: null },
  awsSecretKeyEncrypted: { type: String, default: null },
  googleDriveEnabled: { type: Boolean, default: false },
  googleSheetsEnabled: { type: Boolean, default: false },
  googleServiceAccountJsonEncrypted: { type: String, default: null },
}, { _id: false, timestamps: true });

const notificationSchema = new Schema<NotificationDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true, default: null },
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  tipo: { type: String, enum: ['info', 'warning', 'error', 'success'], required: true },
  destinatarioId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  empreendimentoId: { type: Schema.Types.ObjectId, ref: 'Empreendimento' },
  lida: { type: Boolean, default: false, index: true },
}, { timestamps: true });
notificationSchema.index({ tenantId: 1, destinatarioId: 1, lida: 1, createdAt: -1 });

const documentoSchema = new Schema<DocumentoDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true, index: true },
  category: { type: String, default: 'Outros', index: true },
  fileId: { type: String, required: true },
  url: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
documentoSchema.index({ tenantId: 1, empreendimento: 1, category: 1 });
documentoSchema.index({ tenantId: 1, name: 'text' });

const empreendimentoSchema = new Schema<EmpreendimentoDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, index: true },
  address: { type: String, required: true },
  type: { type: String, enum: ['Residencial', 'Comercial', 'Misto', 'Industrial'], required: true, index: true },
  status: { type: String, enum: ['Planejamento', 'Em andamento', 'Concluído'], required: true, index: true },
  totalUnits: { type: Number, required: true },
  soldUnits: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  description: { type: String },
  responsiblePerson: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, required: true },
  image: { type: String },
  folderId: { type: String },
  sheetId: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
empreendimentoSchema.index({ tenantId: 1, status: 1 });
empreendimentoSchema.index({ tenantId: 1, type: 1 });
empreendimentoSchema.index({ tenantId: 1, name: 'text' });

const attachmentSubSchema = new Schema<Attachment>({
  fileId: { type: String },
  name: { type: String },
  url: { type: String },
}, { _id: true });

const despesaSchema = new Schema<DespesaDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  description: { type: String, required: true },
  value: { type: Number, required: true },
  date: { type: Date, required: true, index: true },
  dueDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ['Pago', 'Pendente', 'A vencer', 'Rejeitado'], default: 'Pendente', index: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true, index: true },
  category: { type: String, enum: ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'], required: true, index: true },
  paymentMethod: { type: String },
  notes: { type: String },
  attachments: [attachmentSubSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvalStatus: { type: String, enum: ['Pendente', 'Aprovado', 'Rejeitado'], default: 'Pendente', required: true, index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true });
despesaSchema.index({ tenantId: 1, empreendimento: 1 });
despesaSchema.index({ tenantId: 1, dueDate: 1 });
despesaSchema.index({ tenantId: 1, status: 1 });
despesaSchema.index({ tenantId: 1, approvalStatus: 1 });
despesaSchema.index({ tenantId: 1, category: 1 });
despesaSchema.index({ tenantId: 1, empreendimento: 1, dueDate: 1 });
despesaSchema.index({ tenantId: 1, description: 'text', notes: 'text' });

const integrationLogSchema = new Schema<IntegrationLogDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  integration: { type: String, required: true, enum: ['GoogleDrive', 'GoogleSheets', 'S3', 'Database', 'Outro'], index: true },
  action: { type: String, required: true, enum: ['UPLOAD', 'DOWNLOAD', 'SYNC', 'CREATE_FOLDER', 'DELETE', 'GET_CONFIG', 'UPDATE_SHEET', 'BACKUP', 'CREATE_EXPENSE', 'UPDATE_EXPENSE', 'REVIEW_EXPENSE', 'DELETE_EXPENSE'], index: true },
  status: { type: String, required: true, enum: ['SUCCESS', 'ERROR', 'WARNING'], index: true },
  details: { type: Schema.Types.Mixed, required: false },
}, { timestamps: true });
integrationLogSchema.index({ tenantId: 1, createdAt: -1 });
integrationLogSchema.index({ integration: 1, status: 1 });

const userSchema = new Schema<UserDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'manager', 'user'], required: true },
  subscriptionStatus: { type: String, enum: ['active', 'past_due', 'canceled', 'trialing'] },
  avatarUrl: { type: String },
  notificationPreferences: {
    emailDespesasVencer: { type: Boolean, default: true },
    emailDocumentosNovos: { type: Boolean, default: true },
    emailRelatoriosSemanais: { type: Boolean, default: false },
    systemDespesasVencer: { type: Boolean, default: true },
    systemDocumentosNovos: { type: Boolean, default: true },
    systemEventosCalendario: { type: Boolean, default: true },
    antecedenciaVencimento: { type: Number, default: 3 },
  },
  preferences: {
    language: { type: String, default: 'pt-BR' },
    dateFormat: { type: String, default: 'dd/MM/yyyy' },
    currency: { type: String, default: 'BRL' },
  },
  assignedEmpreendimentos: [{ type: Schema.Types.ObjectId, ref: 'Empreendimento' }],
}, { timestamps: true });
userSchema.index({ tenantId: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { tenantId: { $type: 'objectId' } } });
userSchema.index({ tenantId: 1, role: 1 });

// --- Models ---
export const Tenant: Model<TenantDocument> = mongoose.models.Tenant || mongoose.model<TenantDocument>('Tenant', tenantSchema);
export const Subscription: Model<SubscriptionDocument> = mongoose.models.Subscription || mongoose.model<SubscriptionDocument>('Subscription', subscriptionSchema);
export const BillingHistory: Model<BillingHistoryDocument> = mongoose.models.BillingHistory || mongoose.model<BillingHistoryDocument>('BillingHistory', billingHistorySchema);
export const AppSettings: Model<AppSettingsDocument> = mongoose.models.AppSettings || mongoose.model<AppSettingsDocument>('AppSettings', appSettingsSchema);
export const Notification: Model<NotificationDocument> = mongoose.models.Notification || mongoose.model<NotificationDocument>('Notification', notificationSchema);
export const Documento: Model<DocumentoDocument> = mongoose.models.Documento || mongoose.model<DocumentoDocument>('Documento', documentoSchema);
export const Empreendimento: Model<EmpreendimentoDocument> = mongoose.models.Empreendimento || mongoose.model<EmpreendimentoDocument>('Empreendimento', empreendimentoSchema);
export const Despesa: Model<DespesaDocument> = mongoose.models.Despesa || mongoose.model<DespesaDocument>('Despesa', despesaSchema);
export const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema);
export const IntegrationLog: Model<IntegrationLogDocument> = mongoose.models.IntegrationLog || mongoose.model<IntegrationLogDocument>('IntegrationLog', integrationLogSchema);
// ============================================================
// END OF FILE: lib/db/models.ts
// ============================================================