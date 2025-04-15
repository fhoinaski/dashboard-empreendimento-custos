// ============================================================
// ARQUIVO REFATORADO: server/services/TenantService.ts
// (REMOVIDAS TRANSAÇÕES MongoDB - Perde Atomicidade!)
// ATENÇÃO: Não recomendado para produção. Use Replica Set em produção.
// ============================================================
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { z } from 'zod';

// Import Models and Interfaces
import {
  Tenant,
  TenantDocument,
  User,
  UserDocument,
  Subscription,
  SubscriptionDocument,
  AppSettings,
  AppSettingsDocument,
} from '@/lib/db/models';
import type { CreateTenantWithAdminInput, TenantStatus } from '@/server/api/schemas/tenants';
import connectToDatabase from '@/lib/db/mongodb'; // Importar conexão DB

// Custom Error Class (mantida)
class TenantServiceError extends Error {
  constructor(message: string, public code: string = 'TENANT_SERVICE_ERROR') {
    super(message);
    this.name = 'TenantServiceError';
  }
}

// Constants (mantidas)
const SALT_ROUNDS = 12;
const MAX_SLUG_ATTEMPTS = 5;

// Helper Function for Slug Generation (REMOVIDO { session })
async function generateUniqueSlug(base: string): Promise<string> {
  let slug = slugify(base, { lower: true, strict: true });
  let attempt = 0;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const existingTenant = await Tenant.findOne({ slug }); // Sem session
    if (!existingTenant) return slug;

    slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    attempt++;
  }

  throw new TenantServiceError(`Não foi possível gerar slug único para '${base}' após ${MAX_SLUG_ATTEMPTS} tentativas`, 'SLUG_GENERATION_FAILED');
}

export class TenantService {
  /**
   * Cria um novo Tenant, Admin user, Subscription, e AppSettings.
   * SEM TRANSAÇÃO - OPERAÇÕES NÃO SÃO ATÔMICAS.
   * Retorna um objeto com detalhes ou lança TenantServiceError em caso de falha.
   */
  async createTenantWithAdmin(
    input: CreateTenantWithAdminInput
  ): Promise<{ success: boolean; message: string; tenantId?: string; adminUserId?: string; error?: string }> {
    console.log('[TenantService] createTenantWithAdmin (SEM TRANSAÇÃO):', input.tenantName);

    await connectToDatabase(); // Garante conexão

    let createdTenantId: mongoose.Types.ObjectId | null = null;
    let createdAdminId: mongoose.Types.ObjectId | null = null;
    let createdSubscriptionId: mongoose.Types.ObjectId | null = null;
    // AppSettings usa o mesmo ID do Tenant

    try {
      // 1. Verificar email existente
      const existingAdmin = await User.findOne({ email: input.adminEmail });
      if (existingAdmin) {
        throw new TenantServiceError(`Email ${input.adminEmail} já está em uso`, 'EMAIL_IN_USE');
      }

      // 2. Gerar Slug e Criar Tenant
      const tenantSlug = await generateUniqueSlug(input.slug || input.tenantName);
      const newTenant = new Tenant({
        name: input.tenantName,
        slug: tenantSlug,
        status: 'pending' satisfies TenantStatus,
      });
      await newTenant.save(); // Sem session
      createdTenantId = newTenant._id;
      console.log(`[TenantService] Tenant criado: ${createdTenantId}`);

      // 3. Criar Admin User
      const hashedPassword = await bcrypt.hash(input.adminPassword, SALT_ROUNDS);
      const newAdminUser = new User({
        tenantId: newTenant._id, name: input.adminName, email: input.adminEmail,
        password: hashedPassword, role: 'admin', assignedEmpreendimentos: [],
        notificationPreferences: {}, preferences: {},
      });
      await newAdminUser.save(); // Sem session
      createdAdminId = newAdminUser._id;
      console.log(`[TenantService] Admin criado: ${createdAdminId}`);

      // 4. Criar Subscription
      const newSubscription = new Subscription({
        tenantId: newTenant._id, plan: input.plan, price: 0,
        status: input.plan === 'free' ? 'active' : 'trialing', startDate: new Date(),
      });
      await newSubscription.save(); // Sem session
      createdSubscriptionId = newSubscription._id as mongoose.Types.ObjectId;
      console.log(`[TenantService] Subscription criada: ${createdSubscriptionId}`);

      // 5. Criar AppSettings
      const newAppSettings = new AppSettings({
        _id: newTenant._id, // Usa o mesmo ID
        tenantId: newTenant._id, companyName: newTenant.name,
        googleDriveEnabled: false, googleSheetsEnabled: false,
      });
      await newAppSettings.save(); // Sem session
      console.log(`[TenantService] AppSettings criado para Tenant: ${createdTenantId}`);

      // Se chegou aqui, todas as operações individuais foram bem-sucedidas
      console.log(`[TenantService] Tenant ${newTenant._id} e Admin ${newAdminUser._id} criados com sucesso (SEM TRANSAÇÃO).`);
      return {
        success: true, message: `Tenant '${newTenant.name}' criado.`,
        tenantId: newTenant._id.toString(), adminUserId: newAdminUser._id.toString(),
      };

    } catch (error: any) {
      console.error('[TenantService] Erro em createTenantWithAdmin (SEM TRANSAÇÃO):', error);

      // TENTATIVA DE LIMPEZA MANUAL (Rollback Parcial) - Pode falhar também
      console.error('[TenantService] Tentando limpar dados criados devido ao erro...');
      if (createdAdminId) {
        console.error(`   -> Excluindo Admin User ${createdAdminId}`);
        await User.findByIdAndDelete(createdAdminId).catch(e => console.error("      Erro ao excluir User:", e));
      }
      if (createdSubscriptionId) {
        console.error(`   -> Excluindo Subscription ${createdSubscriptionId}`);
        await Subscription.findByIdAndDelete(createdSubscriptionId).catch(e => console.error("      Erro ao excluir Subscription:", e));
      }
      if (createdTenantId) {
        console.error(`   -> Excluindo AppSettings ${createdTenantId}`);
        await AppSettings.findByIdAndDelete(createdTenantId).catch(e => console.error("      Erro ao excluir AppSettings:", e));
        console.error(`   -> Excluindo Tenant ${createdTenantId}`);
        await Tenant.findByIdAndDelete(createdTenantId).catch(e => console.error("      Erro ao excluir Tenant:", e));
      }
      console.error('[TenantService] Limpeza manual tentada.');

      // Retorna um erro estruturado
      return { success: false, message: 'Falha na criação do tenant', error: error.message || String(error) };
    }
    // `finally` não é necessário pois não há sessão para fechar
  }

  /**
   * Atualiza o status de um tenant.
   * Retorna true se sucesso, lança TenantServiceError se não encontrar ou falhar.
   */
  async updateTenantStatus(tenantId: string, status: TenantStatus): Promise<boolean> {
    if (!mongoose.isValidObjectId(tenantId)) {
      throw new TenantServiceError(`ID de Tenant inválido: ${tenantId}`, 'INVALID_ID');
    }
    console.log(`[TenantService] updateTenantStatus: ID=${tenantId}, Status=${status}`);
    await connectToDatabase();
    const result = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );
    if (!result) {
       throw new TenantServiceError(`Tenant com ID ${tenantId} não encontrado.`, 'NOT_FOUND');
    }
    return true;
  }

  /**
   * Busca as configurações de AppSettings de um tenant.
   * Retorna o documento de configurações ou null.
   */
   async getTenantAppSettings(tenantId: string | mongoose.Types.ObjectId): Promise<AppSettingsDocument | null> {
       if (!mongoose.isValidObjectId(tenantId)) {
           console.warn(`[TenantService.getTenantAppSettings] Invalid tenantId: ${tenantId}`);
           return null;
       }
       await connectToDatabase();
       return AppSettings.findOne({ tenantId: new mongoose.Types.ObjectId(tenantId) }).lean<AppSettingsDocument>();
   }

   /**
    * Busca a configuração de integrações de um tenant.
    */
   async getTenantConfig(tenantId: string | mongoose.Types.ObjectId): Promise<{ googleDriveEnabled: boolean; googleSheetsEnabled: boolean; googleServiceAccountConfigured: boolean } | null> {
       if (!mongoose.isValidObjectId(tenantId)) {
           console.warn(`[TenantService.getTenantConfig] Invalid tenantId: ${tenantId}`);
           return null;
       }
       const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);
       console.log(`[TenantService.getTenantConfig] Fetching config for Tenant: ${objectIdTenantId}`);
       try {
           await connectToDatabase();
           const settings = await AppSettings.findOne({ tenantId: objectIdTenantId })
               .select('googleDriveEnabled googleSheetsEnabled googleServiceAccountJsonEncrypted')
               .lean();

           if (!settings) {
               console.warn(`[TenantService.getTenantConfig] No settings found for Tenant: ${objectIdTenantId}, returning defaults.`);
               return { googleDriveEnabled: false, googleSheetsEnabled: false, googleServiceAccountConfigured: false };
           }

           const config = {
               googleDriveEnabled: !!settings.googleDriveEnabled,
               googleSheetsEnabled: !!settings.googleSheetsEnabled,
               googleServiceAccountConfigured: !!settings.googleServiceAccountJsonEncrypted,
           };
           console.log(`[TenantService.getTenantConfig] Config found for Tenant ${objectIdTenantId}:`, config);
           return config;
       } catch (error: any) {
           console.error(`[TenantService.getTenantConfig] Error fetching config for Tenant ${objectIdTenantId}:`, error);
           throw new TenantServiceError(`Failed to fetch tenant configuration: ${error.message}`, 'CONFIG_FETCH_FAILED');
       }
   }
}
// ============================================================
// FIM DO ARQUIVO REFATORADO (SEM TRANSAÇÕES)
// ============================================================