import mongoose from 'mongoose';
import { IntegrationLog } from '@/lib/db/models'; // Import the Mongoose model
import type { IntegrationLogDocument } from '@/lib/db/models'; // Import the interface

// Type alias for easier use
type Integration = IntegrationLogDocument['integration'];
type Action = IntegrationLogDocument['action'];
type Status = IntegrationLogDocument['status'];
type Details = IntegrationLogDocument['details'];

/**
 * Logs an integration operation attempt to the IntegrationLogs collection.
 *
 * @param tenantId - The ID of the tenant performing the operation.
 * @param integration - The name of the integrated service (e.g., 'GoogleDrive', 'GoogleSheets').
 * @param action - The type of action performed (e.g., 'UPLOAD', 'SYNC').
 * @param status - The result status ('SUCCESS', 'ERROR', 'WARNING').
 * @param details - An object or string containing relevant details (e.g., fileId, errorMessage, parameters).
 */
export async function logIntegration(
    tenantId: string | mongoose.Types.ObjectId | undefined | null,
    integration: Integration,
    action: Action,
    status: Status,
    details: Details = {} // Default to empty object
): Promise<void> {

    // Validate Tenant ID before logging
    if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
        console.error(`[IntegrationLogger] Invalid or missing Tenant ID provided. Integration: ${integration}, Action: ${action}, Status: ${status}`);
        // Decide if you want to log this error itself, or just prevent logging the original event
        // For now, just log the error and prevent logging the original event
        return;
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    console.log(`[IntegrationLogger] Logging: Tenant=${tenantObjectId}, Int=${integration}, Act=${action}, Stat=${status}`);

    try {
        await IntegrationLog.create({
            tenantId: tenantObjectId,
            integration,
            action,
            status,
            details,
            // createdAt/updatedAt are handled by timestamps: true
        });
        console.log(`[IntegrationLogger] Log entry created successfully.`);

    } catch (error) {
        console.error(`[IntegrationLogger] Failed to create log entry for Tenant ${tenantObjectId}:`, {
            integration,
            action,
            status,
            details, // Log details even on logging failure for debugging
            dbError: error,
        });
        // Depending on severity, you might want to re-throw or notify admins
    }
}