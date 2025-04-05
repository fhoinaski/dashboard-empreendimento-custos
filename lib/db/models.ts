// lib/db/models.ts
import mongoose, { Schema, Document, Types, Model } from 'mongoose';

// --- Interfaces (sem alterações) ---
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
  status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado'; // Adicionado Rejeitado
  empreendimento: Types.ObjectId;
  category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
  paymentMethod?: string;
  notes?: string;
  attachments?: Attachment[];
  createdBy: Types.ObjectId; // Tornar obrigatório
  createdAt: Date;
  updatedAt: Date;
  // --- CAMPOS PARA AUDITORIA --- // Mantido
  approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado';
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
  updatedAt: Date;
}

// --- Schemas ---

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, minlength: 2 },
  email: { type: String, required: true, unique: true, match: [/.+\@.+\..+/, 'Email inválido'], index: true }, // Adicionado index no email
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'manager', 'user'] as const, default: 'user' }, // Usar 'as const' para melhor tipagem
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
    default: []
    // Não indexar diretamente aqui, pois consultas baseadas neste array podem ser complexas.
    // Se precisar buscar usuários por empreendimento, pode ser melhor um índice separado ou outra estratégia.
  },
}, { timestamps: true });

const empreendimentoSchema = new Schema<EmpreendimentoDocument>({
  name: { type: String, required: true, minlength: 2, index: true }, // Indexar nome para busca/listagem
  address: { type: String, required: true },
  type: { type: String, enum: ['Residencial', 'Comercial', 'Misto', 'Industrial'] as const, required: true, index: true }, // Indexar tipo
  status: { type: String, enum: ['Planejamento', 'Em andamento', 'Concluído'] as const, required: true, index: true }, // Indexar status
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
}, { timestamps: true });

const despesaSchema = new Schema<DespesaDocument>({
  description: { type: String, required: true, minlength: 2 },
  value: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  dueDate: { type: Date, required: true }, // Será indexado
  status: { type: String, enum: ['Pago', 'Pendente', 'A vencer', 'Rejeitado'] as const, default: 'Pendente' }, // Será indexado
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true }, // Será indexado
  category: { type: String, enum: ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'] as const, required: true }, // Pode ser indexado se houver muitos filtros por categoria
  paymentMethod: { type: String, default: '' },
  notes: { type: String, default: '' },
  attachments: [{ _id: false, fileId: String, name: String, url: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Será indexado
  approvalStatus: { type: String, enum: ['Pendente', 'Aprovado', 'Rejeitado'] as const, default: 'Pendente', required: true }, // Será indexado
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

// --- ÍNDICES PARA O MODELO Despesa ---

// Índices Simples (campos frequentemente usados em filtros isolados ou ordenação)
despesaSchema.index({ empreendimento: 1 });       // Filtrar por empreendimento
despesaSchema.index({ dueDate: 1 });              // Ordenar/filtrar por data de vencimento (ascendente)
despesaSchema.index({ dueDate: -1 });             // Ordenar por data de vencimento (descendente)
despesaSchema.index({ status: 1 });               // Filtrar por status financeiro
despesaSchema.index({ createdBy: 1 });            // Filtrar por quem criou
despesaSchema.index({ approvalStatus: 1 });       // Filtrar por status de aprovação
// despesaSchema.index({ category: 1 });          // Opcional: se filtrar muito por categoria

// Índices Compostos (otimizam consultas com múltiplos filtros/ordenação)
// Exemplo: Listar despesas de um empreendimento, ordenadas por vencimento (comum na lista)
despesaSchema.index({ empreendimento: 1, dueDate: -1 });
// Exemplo: Filtrar por status financeiro e ordenar por vencimento
despesaSchema.index({ status: 1, dueDate: 1 });
// Exemplo: Filtrar por status de aprovação e ordenar por vencimento (para tela de revisão)
despesaSchema.index({ approvalStatus: 1, dueDate: 1 });
// Exemplo: Filtrar por quem criou e ordenar por vencimento (para visão do usuário)
despesaSchema.index({ createdBy: 1, dueDate: -1 });
// Exemplo: Índice mais abrangente para a listagem principal (se filtra por empreendimento, status e ordena por data)
despesaSchema.index({ empreendimento: 1, status: 1, dueDate: -1 });
// Exemplo: Índice para o summary/dashboard (filtrando por empreendimento e data, agrupando por status/approval)
despesaSchema.index({ empreendimento: 1, dueDate: 1, status: 1, approvalStatus: 1 });

// --- FIM DOS ÍNDICES ---


const documentoSchema = new Schema({
  name: { type: String, required: true, minlength: 2 },
  type: { type: String, required: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true, index: true }, // Indexar por empreendimento
  category: { type: String, default: 'Outros', index: true }, // Indexar categoria
  fileId: { type: String, required: true },
  url: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Opcional: Índice composto para documentos
documentoSchema.index({ empreendimento: 1, category: 1 });


const appSettingsSchema = new Schema({
  _id: { type: String, default: 'global_settings' }, // Garante ID único para o documento de config
  companyName: { type: String },
  cnpj: { type: String },
  companyAddress: { type: String },
  companyPhone: { type: String },
  companyEmail: { type: String },
  logoUrl: { type: String },
  googleApiKeyEncrypted: { type: String }, // Campo para chave Google criptografada
  awsApiKeyEncrypted: { type: String },    // Campo para chave AWS criptografada
  awsSecretKeyEncrypted: { type: String }, // Campo para segredo AWS criptografado
  updatedAt: { type: Date, default: Date.now },
}, { _id: false }); // Desabilita o _id automático do Mongoose para usar o nosso padrão

// --- Models ---
// Verifica se o modelo já existe antes de criá-lo (boa prática no Next.js)
export const User: Model<UserDocument> = mongoose.models.User || mongoose.model<UserDocument>('User', userSchema);
export const Empreendimento: Model<EmpreendimentoDocument> = mongoose.models.Empreendimento || mongoose.model<EmpreendimentoDocument>('Empreendimento', empreendimentoSchema);
export const Despesa: Model<DespesaDocument> = mongoose.models.Despesa || mongoose.model<DespesaDocument>('Despesa', despesaSchema);
export const Documento = mongoose.models.Documento || mongoose.model('Documento', documentoSchema);
export const AppSettings = mongoose.models.AppSettings || mongoose.model('AppSettings', appSettingsSchema);