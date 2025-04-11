// ============================================================
// FILE: server/services/tenant.service.ts
// DESCRIPTION: Service for managing tenant-related operations, including creation, listing, and configuration.
// ============================================================

import mongoose, { FilterQuery, ClientSession } from 'mongoose';
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

// Custom Error Class for Tenant Service
class TenantServiceError extends Error {
  constructor(message: string, public code: string = 'TENANT_SERVICE_ERROR') {
    super(message);
    this.name = 'TenantServiceError';
  }
}

// Validation Schemas
const createTenantSchema = z.object({
  tenantName: z.string().min(3, 'Tenant name must be at least 3 characters').max(100),
  slug: z.string().optional(),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters').max(100),
  adminEmail: z.string().email('Invalid admin email').max(255),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  plan: z.enum(['free', 'pro', 'enterprise'], { message: 'Invalid subscription plan' }),
});

const listTenantsFilterSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  status: z.enum(['active', 'pending', 'suspended', 'cancelled']).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'slug', 'status', 'createdAt', '_id']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Interface for Tenant Config
interface TenantConfig {
  googleDriveEnabled: boolean;
  googleSheetsEnabled: boolean;
}

// Constants
const SALT_ROUNDS = 12;
const MAX_SLUG_ATTEMPTS = 5;

// Helper Function for Slug Generation
async function generateUniqueSlug(base: string, session: ClientSession): Promise<string> {
  let slug = slugify(base, { lower: true, strict: true });
  let attempt = 0;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const existingTenant = await Tenant.findOne({ slug }).session(session);
    if (!existingTenant) return slug;

    slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    attempt++;
  }

  throw new TenantServiceError(`Unable to generate unique slug for base '${base}' after ${MAX_SLUG_ATTEMPTS} attempts`, 'SLUG_GENERATION_FAILED');
}

export class TenantService {
  /**
   * Creates a new Tenant, Admin user, Subscription, and AppSettings within a transaction.
   * @param input - Input data for tenant and admin creation
   * @returns Object indicating success, message, and IDs or error details
   */
  async createTenantWithAdmin(
    input: CreateTenantWithAdminInput
  ): Promise<{ success: boolean; message: string; tenantId?: string; adminUserId?: string; error?: string }> {
    console.log('[TenantService] Initiating createTenantWithAdmin:', input.tenantName);

    // Validate input
    const validatedInput = createTenantSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessage = validatedInput.error.errors.map((e) => e.message).join(', ');
      return { success: false, message: 'Validation failed', error: errorMessage };
    }

    const session: ClientSession = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check for existing admin email
      const existingAdmin = await User.findOne({ email: input.adminEmail }).session(session);
      if (existingAdmin) {
        throw new TenantServiceError(`Email ${input.adminEmail} is already in use`, 'EMAIL_IN_USE');
      }

      // Generate and validate slug
      const tenantSlug = await generateUniqueSlug(input.slug || input.tenantName, session);
      console.log(`[TenantService] Using slug: '${tenantSlug}'`);

      // Create Tenant
      const newTenant = new Tenant({
        name: input.tenantName,
        slug: tenantSlug,
        status: 'pending' satisfies TenantStatus,
      });
      await newTenant.save({ session });
      console.log(`[TenantService] Tenant created with ID: ${newTenant._id}`);

      // Hash Admin Password
      const hashedPassword = await bcrypt.hash(input.adminPassword, SALT_ROUNDS);

      // Create Admin User
      const newAdminUser = new User({
        tenantId: newTenant._id,
        name: input.adminName,
        email: input.adminEmail,
        password: hashedPassword,
        role: 'admin',
        assignedEmpreendimentos: [],
        notificationPreferences: {},
        preferences: {},
      });
      await newAdminUser.save({ session });
      console.log(`[TenantService] Admin User created with ID: ${newAdminUser._id}`);

      // Create Initial Subscription
      const newSubscription = new Subscription({
        tenantId: newTenant._id,
        plan: input.plan,
        price: 0, // Placeholder; replace with actual pricing logic
        status: input.plan === 'free' ? 'active' : 'trialing',
        startDate: new Date(),
      });
      await newSubscription.save({ session });
      console.log(`[TenantService] Subscription (${input.plan}) created for Tenant ${newTenant._id}`);

      // Create Initial AppSettings
      const newAppSettings = new AppSettings({
        _id: newTenant._id,
        tenantId: newTenant._id,
        companyName: newTenant.name,
        googleDriveEnabled: false,
        googleSheetsEnabled: false,
      });
      await newAppSettings.save({ session });
      console.log(`[TenantService] AppSettings created for Tenant ${newTenant._id}`);

      await session.commitTransaction();
      return {
        success: true,
        message: `Tenant '${newTenant.name}' and Admin '${newAdminUser.email}' created successfully (Status: ${newTenant.status}).`,
        tenantId: newTenant._id.toString(),
        adminUserId: newAdminUser._id.toString(),
      };
    } catch (error: any) {
      await session.abortTransaction();
      console.error('[TenantService] Error in createTenantWithAdmin:', error);
      return {
        success: false,
        message: 'Failed to create Tenant and Admin',
        error: error.message || String(error),
      };
    } finally {
      await session.endSession();
      console.log('[TenantService] Session ended.');
    }
  }

  /**
   * Lists tenants with pagination and filtering.
   * @param filters - Filtering and pagination options
   * @returns Tenants and pagination metadata
   */
  async listTenants(
    filters: z.infer<typeof listTenantsFilterSchema>
  ): Promise<{
    tenants: TenantDocument[];
    pagination: { total: number; limit: number; page: number; pages: number; hasMore: boolean };
  }> {
    const validatedFilters = listTenantsFilterSchema.parse(filters);
    const { page, limit, status, search, sortBy, sortOrder } = validatedFilters;
    const skip = (page - 1) * limit;
    const queryFilter: FilterQuery<TenantDocument> = {};

    if (status) queryFilter.status = status;
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      queryFilter.$or = [{ name: { $regex: esc, $options: 'i' } }, { slug: { $regex: esc, $options: 'i' } }];
    }

    const sortCriteria: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    if (sortBy !== '_id') sortCriteria['_id'] = -1;

    const [tenants, total] = await Promise.all([
      Tenant.find(queryFilter).sort(sortCriteria).skip(skip).limit(limit).lean<TenantDocument[]>(),
      Tenant.countDocuments(queryFilter),
    ]);

    return {
      tenants,
      pagination: { total, limit, page, pages: Math.ceil(total / limit), hasMore: page * limit < total },
    };
  }

  /**
   * Retrieves a tenant by ID.
   * @param tenantId - The ID of the tenant
   * @returns Tenant document or null if not found
   */
  async getTenantById(tenantId: string): Promise<TenantDocument | null> {
    if (!mongoose.isValidObjectId(tenantId)) {
      console.warn(`[TenantService.getTenantById] Invalid tenantId: ${tenantId}`);
      return null;
    }
    return Tenant.findById(tenantId).lean<TenantDocument>();
  }

  /**
   * Updates the status of a tenant.
   * @param tenantId - The ID of the tenant
   * @param status - The new status
   * @returns True if updated successfully, false otherwise
   */
  async updateTenantStatus(tenantId: string, status: TenantStatus): Promise<boolean> {
    if (!mongoose.isValidObjectId(tenantId)) {
      console.error(`[TenantService.updateTenantStatus] Invalid ID: ${tenantId}`);
      return false;
    }
    console.log(`[TenantService.updateTenantStatus] Updating ${tenantId} to status: ${status}`);
    const result = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );
    return !!result;
  }

  /**
   * Retrieves integration configurations for a tenant.
   * @param tenantId - The ID of the tenant
   * @returns Tenant configuration or null if invalid
   */
  async getTenantConfig(tenantId: string | mongoose.Types.ObjectId | undefined | null): Promise<TenantConfig | null> {
    if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
      console.warn(`[TenantService.getTenantConfig] Invalid tenantId: ${tenantId}`);
      return null;
    }
    const objectIdTenantId = new mongoose.Types.ObjectId(tenantId);
    console.log(`[TenantService.getTenantConfig] Fetching config for Tenant: ${objectIdTenantId}`);

    try {
      const settings = await AppSettings.findOne({ tenantId: objectIdTenantId })
        .select('googleDriveEnabled googleSheetsEnabled')
        .lean<{ googleDriveEnabled?: boolean; googleSheetsEnabled?: boolean } | null>();

      if (!settings) {
        console.warn(`[TenantService.getTenantConfig] No settings found for Tenant: ${objectIdTenantId}`);
        return { googleDriveEnabled: false, googleSheetsEnabled: false };
      }

      const config: TenantConfig = {
        googleDriveEnabled: !!settings.googleDriveEnabled,
        googleSheetsEnabled: !!settings.googleSheetsEnabled,
      };
      console.log(`[TenantService.getTenantConfig] Config for Tenant ${objectIdTenantId}:`, config);
      return config;
    } catch (error: any) {
      console.error(`[TenantService.getTenantConfig] Error fetching config for Tenant ${objectIdTenantId}:`, error);
      return null;
    }
  }
}

// Ensure indexes for performance
Tenant.collection.createIndex({ slug: 1 }, { unique: true });
Tenant.collection.createIndex({ name: 'text', slug: 'text' });
User.collection.createIndex({ email: 1 }, { unique: true });
AppSettings.collection.createIndex({ tenantId: 1 }, { unique: true });