import mongoose, { Schema } from 'mongoose';

// Modelo para Usuários
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  activeSessions: [{
    sessionId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastUsed: { type: Date, default: Date.now },
    deviceInfo: { type: String }, // Opcional: User-Agent ou IP
  }],
});

// Modelo para Empreendimentos
const empreendimentoSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    type: { type: String, enum: ['Residencial', 'Comercial', 'Misto', 'Industrial'], required: true },
    status: { type: String, enum: ['Planejamento', 'Em andamento', 'Concluído'], required: true },
    totalUnits: { type: Number, required: true },
    soldUnits: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String },
    responsiblePerson: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    image: { type: String }, // Já existe para a foto de capa
    documents: [{ type: String }], // Novo campo para armazenar links dos documentos
    folderId: { type: String }, // ID da pasta no Google Drive, já existente
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  });

// Modelo para Despesas
const despesaSchema = new Schema({
  description: { type: String, required: true },
  value: { type: Number, required: true },
  date: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['Pago', 'Pendente', 'A vencer'], default: 'Pendente' },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true },
  category: { type: String, enum: ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'] },
  paymentMethod: { type: String },
  notes: { type: String },
  // Anexos no Google Drive
  attachments: [{
    fileId: { type: String },
    name: { type: String },
    url: { type: String },
  }],
  // Metadados
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Modelo para Documentos
const documentoSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  empreendimento: { type: Schema.Types.ObjectId, ref: 'Empreendimento', required: true },
  category: { type: String },
  // Google Drive
  fileId: { type: String, required: true },
  url: { type: String },
  // Metadados
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Verificar se os modelos já existem antes de criar novos
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Empreendimento = mongoose.models.Empreendimento || mongoose.model('Empreendimento', empreendimentoSchema);
export const Despesa = mongoose.models.Despesa || mongoose.model('Despesa', despesaSchema);
export const Documento = mongoose.models.Documento || mongoose.model('Documento', documentoSchema);