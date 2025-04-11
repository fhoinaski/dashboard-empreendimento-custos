// FILE: lib/google/sheets.ts
// STATUS: REFACTORED TO FIX TS ERRORS (Property 'sheetId' does not exist)
// ============================================================
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import mongoose from 'mongoose';
import { AppSettings, AppSettingsDocument } from '@/lib/db/models'; // AppSettingsDocument já deve incluir sheetId?
import { decrypt } from '@/lib/crypto'; // Function to decrypt credentials

// Interface for service account credentials structure
interface ServiceAccountCredentials {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain?: string;
}

// *** FIX START: Define a specific interface for the lean query result ***
interface AppSettingsLeanSheetConfig {
    _id?: mongoose.Types.ObjectId; // Include _id if needed elsewhere
    tenantId?: mongoose.Types.ObjectId; // Include tenantId if needed elsewhere
    googleSheetsEnabled?: boolean;
    googleServiceAccountJsonEncrypted?: string | null;
    sheetId?: string | null; // <-- Explicitly include sheetId here
}
// *** FIX END ***


/**
 * Fetches Google Service Account credentials and Sheet ID for a specific tenant.
 * @param tenantId - The ID of the tenant.
 * @returns An object containing credentials and sheetId, or null if not configured/enabled.
 */
async function getTenantGoogleSheetConfig(tenantId: string | mongoose.Types.ObjectId): Promise<{ credentials: ServiceAccountCredentials; sheetId: string } | null> {
    if (!mongoose.isValidObjectId(tenantId)) {
        console.error(`[SheetsLib] getTenantConfig: Invalid Tenant ID format: ${tenantId}`);
        return null;
    }
    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    console.log(`[SheetsLib] getTenantConfig: Fetching Sheets config for Tenant ID: ${tenantObjectId}`);

    try {
        // *** FIX: Use the specific lean type in the query ***
        const settings = await AppSettings.findOne({ tenantId: tenantObjectId })
            .select('googleSheetsEnabled googleServiceAccountJsonEncrypted sheetId') // Select necessary fields
            .lean<AppSettingsLeanSheetConfig | null>(); // <-- Use the specific lean type here

        if (!settings) {
             console.warn(`[SheetsLib] getTenantConfig: AppSettings not found for Tenant: ${tenantObjectId}`);
             return null;
        }

        if (!settings.googleSheetsEnabled) {
            console.log(`[SheetsLib] getTenantConfig: Google Sheets integration is disabled for Tenant: ${tenantObjectId}`);
            return null;
        }

        if (!settings.googleServiceAccountJsonEncrypted) {
            console.warn(`[SheetsLib] getTenantConfig: Service Account JSON not configured for Tenant: ${tenantObjectId}`);
            return null;
        }

        // *** FIX: Check for sheetId from the lean result ***
        if (!settings.sheetId) { // <-- Access sheetId directly from the typed lean result
             console.warn(`[SheetsLib] getTenantConfig: Sheet ID not configured for Tenant: ${tenantObjectId}`);
             return null;
        }
        // *** FIX END ***

        const decryptedJson = await decrypt(settings.googleServiceAccountJsonEncrypted);
        if (!decryptedJson) {
            console.error(`[SheetsLib] getTenantConfig: Failed to decrypt Service Account JSON for Tenant: ${tenantObjectId}`);
            return null;
        }

        const credentials = JSON.parse(decryptedJson);
        if (!credentials.client_email || !credentials.private_key) {
            console.error(`[SheetsLib] getTenantConfig: Decrypted JSON is invalid (missing fields) for Tenant: ${tenantObjectId}`);
            return null;
        }

        console.log(`[SheetsLib] getTenantConfig: Sheets config found for Tenant ${tenantObjectId}. Sheet ID: ${settings.sheetId}`);
        // *** FIX: Use sheetId from the typed lean result ***
        return { credentials: credentials as ServiceAccountCredentials, sheetId: settings.sheetId }; // <-- settings.sheetId is now recognized

    } catch (error) {
        console.error(`[SheetsLib] getTenantConfig: Error fetching config for Tenant ${tenantObjectId}:`, error);
        return null;
    }
}

/**
 * Creates an authenticated Google Sheets API client for a specific tenant.
 * @param tenantId - The ID of the tenant.
 * @returns An initialized sheets_v4.Sheets client or null if configuration fails.
 */
async function getSheetsClientForTenant(tenantId: string | mongoose.Types.ObjectId): Promise<sheets_v4.Sheets | null> {
    const config = await getTenantGoogleSheetConfig(tenantId);
    if (!config) {
        console.error(`[SheetsLib] getClient: Cannot create Sheets client, config not available for Tenant: ${tenantId}`);
        return null;
    }

    const { credentials } = config;

    try {
        const jwtClient = new JWT({
            email: credentials.client_email,
            key: credentials.private_key.replace(/\\n/g, '\n'), // Handle escaped newlines
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        await jwtClient.authorize(); // Authorize the client
        console.log(`[SheetsLib] getClient: JWT Sheets client created and authorized for Tenant: ${tenantId}`);
        return google.sheets({ version: 'v4', auth: jwtClient });

    } catch (authError) {
        console.error(`[SheetsLib] getClient: Error creating/authorizing Sheets client for Tenant ${tenantId}:`, authError);
        return null;
    }
}

/**
 * Appends a new row with the given data to the specified Google Sheet for a tenant.
 * @param tenantId - The ID of the tenant.
 * @param data - An array representing the row data (e.g., [id, description, value, ...]).
 * @param sheetName - The name of the sheet tab (default: 'Despesas').
 * @param retries - Number of retry attempts on failure.
 * @returns An object indicating success or failure, and potential error message.
 */
export async function appendRowToSheet(
    tenantId: string | mongoose.Types.ObjectId,
    data: any[],
    sheetName: string = 'Despesas', // Default sheet name
    retries = 2
): Promise<{ success: boolean; error?: string; updatedRange?: string | null }> {
    console.log(`[SheetsLib] appendRow: Attempting to add row for Tenant ${tenantId} to sheet '${sheetName}'. Data length: ${data.length}`);
    const sheetsClient = await getSheetsClientForTenant(tenantId);
    const config = await getTenantGoogleSheetConfig(tenantId); // Fetch config again to get sheetId

    // *** FIX: Check config and config.sheetId ***
    if (!sheetsClient || !config?.sheetId) { // <-- Check both config and sheetId
        const errorMsg = !sheetsClient ? 'Sheets client initialization failed.' : 'Sheet ID not found in tenant config.';
        console.error(`[SheetsLib] appendRow: Prerequisite failed for Tenant ${tenantId}: ${errorMsg}`);
        return { success: false, error: `Integração Google Sheets não configurada ou habilitada para este tenant. (${errorMsg})` };
    }
    // *** FIX END ***

    const spreadsheetId = config.sheetId;
    const range = `${sheetName}!A:A`; // Append after the last row in column A

    try {
        // Ensure all data elements are basic types (string, number, boolean) or formatted correctly
        const formattedData = data.map(item => {
            if (item instanceof Date) {
                return item.toISOString(); // Format dates as ISO strings
            }
            if (typeof item === 'object' && item !== null) {
                // Avoid stringifying if it's already a simple type wrapped in an object (like ObjectId)
                 if (item instanceof mongoose.Types.ObjectId) { return item.toString(); }
                return JSON.stringify(item); // Stringify other objects if necessary
            }
            return item === null || item === undefined ? "" : String(item); // Handle null/undefined and convert others to string
        });


        console.log(`[SheetsLib] appendRow: Appending to Spreadsheet: ${spreadsheetId}, Range: ${range}, Data:`, [formattedData]);
        const response = await sheetsClient.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED', // Interpret data as if typed by user
            insertDataOption: 'INSERT_ROWS', // Insert new rows
            requestBody: {
                values: [formattedData], // Data must be an array of arrays
            },
        });

        console.log(`[SheetsLib] appendRow: Row added successfully for Tenant ${tenantId}. Range: ${response.data.updates?.updatedRange}`);
        return { success: true, updatedRange: response.data.updates?.updatedRange };

    } catch (error: any) {
        console.error(`[SheetsLib] appendRow: Error adding row for Tenant ${tenantId} to sheet ${spreadsheetId}:`, error);
        if (retries > 0 && (error.code === 429 || error.code >= 500)) { // Retry on rate limits or server errors
            console.log(`[SheetsLib] appendRow: Retrying (${retries} left) after error code ${error.code}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            return appendRowToSheet(tenantId, data, sheetName, retries - 1);
        }
        const apiError = error.response?.data?.error;
        const errorMessage = apiError?.message || error.message || 'Erro desconhecido ao adicionar linha.';
        console.error(`[SheetsLib] appendRow: Final Error Details for Tenant ${tenantId}:`, apiError || error);
        return { success: false, error: `Falha ao adicionar linha: ${errorMessage} (Code: ${apiError?.code || error.code || 'N/A'})` };
    }
}

/**
 * Updates a specific row in the Google Sheet based on a unique identifier (e.g., Despesa ID).
 * Finds the row containing the identifier in the specified column and updates it.
 * If the row is not found, it attempts to append it as a new row.
 *
 * @param tenantId - The ID of the tenant.
 * @param uniqueId - The unique identifier to find the row (e.g., despesa._id).
 * @param idColumnLetter - The letter of the column containing the unique ID (e.g., 'A').
 * @param newData - An array representing the new row data.
 * @param sheetName - The name of the sheet tab (default: 'Despesas').
 * @param retries - Number of retry attempts on failure.
 * @param tenantId - The ID of the tenant.
 * @param empreendimentoId - The ID of the empreendimento (for logging/tracking).
 * @param empreendimentoName - The name of the empreendimento (used as the sheet title).
 * @returns An object with success status, spreadsheet ID, URL, or error message.
 */

export async function createEmpreendimentoSheet(
    tenantId: string | mongoose.Types.ObjectId,
    empreendimentoId: string,
    empreendimentoName: string
): Promise<{ success: boolean; spreadsheetId?: string; url?: string; error?: string }> {
    console.log(`[SheetsLib] createSheet: Creating sheet for Tenant ${tenantId}, Empreendimento ${empreendimentoId} - ${empreendimentoName}`);
    const sheetsClient = await getSheetsClientForTenant(tenantId);
    const config = await getTenantGoogleSheetConfig(tenantId);

    if (!sheetsClient || !config) {
        const errorMsg = !sheetsClient ? 'Sheets client initialization failed.' : 'Config not found.';
        console.error(`[SheetsLib] createSheet: Prerequisite failed for Tenant ${tenantId}: ${errorMsg}`);
        return { success: false, error: `Integração Google Sheets não configurada. (${errorMsg})` };
    }

    try {
        const response = await sheetsClient.spreadsheets.create({
            requestBody: {
                properties: { title: `${empreendimentoName} - Despesas` },
                sheets: [{ properties: { title: 'Despesas' } }],
            },
        });

        const spreadsheetId = response.data.spreadsheetId;
        const url = response.data.spreadsheetUrl;

        if (!spreadsheetId || !url) {
            throw new Error('Resposta inválida do Google Sheets: ID ou URL não retornados.');
        }

        console.log(`[SheetsLib] createSheet: Sheet created for Tenant ${tenantId}. ID: ${spreadsheetId}, URL: ${url}`);
        return { success: true, spreadsheetId, url };
    } catch (error: any) {
        console.error(`[SheetsLib] createSheet: Error creating sheet for Tenant ${tenantId}:`, error);
        const apiError = error.response?.data?.error;
        const errorMessage = apiError?.message || error.message || 'Erro desconhecido ao criar planilha.';
        return { success: false, error: `Falha ao criar planilha: ${errorMessage}` };
    }
}

export async function updateRowInSheetById(
    tenantId: string | mongoose.Types.ObjectId,
    uniqueId: string,
    idColumnLetter: string = 'A', // Assume ID is in column A
    newData: any[],
    sheetName: string = 'Despesas',
    retries = 2
): Promise<{ success: boolean; error?: string; updatedRow?: number; updatedRange?: string | null }> {
    console.log(`[SheetsLib] updateRow: Attempting update for ID ${uniqueId} in Tenant ${tenantId}, Sheet '${sheetName}'.`);
    const sheetsClient = await getSheetsClientForTenant(tenantId);
    const config = await getTenantGoogleSheetConfig(tenantId);

    // *** FIX: Check config and config.sheetId ***
    if (!sheetsClient || !config?.sheetId) { // <-- Check both config and sheetId
        const errorMsg = !sheetsClient ? 'Sheets client initialization failed.' : 'Sheet ID not found.';
        console.error(`[SheetsLib] updateRow: Prerequisite failed for Tenant ${tenantId}: ${errorMsg}`);
        return { success: false, error: `Integração Google Sheets não configurada. (${errorMsg})` };
    }
    // *** FIX END ***

    const spreadsheetId = config.sheetId;
    const searchRange = `${sheetName}!${idColumnLetter}:${idColumnLetter}`; // Range to search for the ID

    try {
        // 1. Find the row number based on the unique ID
        console.log(`[SheetsLib] updateRow: Searching for ID ${uniqueId} in range ${searchRange}`);
        const searchResponse = await sheetsClient.spreadsheets.values.get({
            spreadsheetId,
            range: searchRange,
        });

        const rows = searchResponse.data.values;
        let rowIndex = -1;
        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                if (rows[i]?.[0] === uniqueId) {
                    rowIndex = i; // Found the row index (0-based)
                    break;
                }
            }
        }

        // If Row NOT found, try appending
        if (rowIndex === -1) {
            console.warn(`[SheetsLib] updateRow: ID ${uniqueId} not found in sheet ${spreadsheetId} for Tenant ${tenantId}. Attempting append.`);
            // Pass retries to append function as well
            const appendResult = await appendRowToSheet(tenantId, newData, sheetName, retries);
            // Return the result of the append attempt
            return {
                success: appendResult.success,
                error: appendResult.error,
                updatedRange: appendResult.updatedRange, // Pass the updatedRange from append
            };
        }

        // If Row FOUND, update it
        const rowNumber = rowIndex + 1; // Sheet row number (1-based)
        const updateRange = `${sheetName}!A${rowNumber}`; // Update the entire row starting from column A
        console.log(`[SheetsLib] updateRow: Found ID ${uniqueId} at row ${rowNumber}. Updating range ${updateRange}.`);

        // 2. Update the found row
        const formattedData = newData.map(item => {
             if (item instanceof Date) return item.toISOString();
             if (item instanceof mongoose.Types.ObjectId) return item.toString(); // Handle ObjectId
             if (typeof item === 'object' && item !== null) return JSON.stringify(item);
             return item === null || item === undefined ? "" : String(item);
        });

        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [formattedData], // Data must be an array of arrays
            },
        });

        console.log(`[SheetsLib] updateRow: Row ${rowNumber} updated successfully for Tenant ${tenantId}.`);
        return { success: true, updatedRow: rowNumber }; // Indicate row number that was updated

    } catch (error: any) {
        console.error(`[SheetsLib] updateRow: Error updating row for ID ${uniqueId}, Tenant ${tenantId}:`, error);
        if (retries > 0 && (error.code === 429 || error.code >= 500)) {
            console.log(`[SheetsLib] updateRow: Retrying (${retries} left)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            // Pass retries to the recursive call
            return updateRowInSheetById(tenantId, uniqueId, idColumnLetter, newData, sheetName, retries - 1);
        }
        const apiError = error.response?.data?.error;
        const errorMessage = apiError?.message || error.message || 'Erro desconhecido ao atualizar linha.';
        console.error(`[SheetsLib] updateRow: Final Error Details:`, apiError || error);
        return { success: false, error: `Falha ao atualizar linha: ${errorMessage} (Code: ${apiError?.code || error.code || 'N/A'})` };
    }
}

// Placeholder for deleteRowInSheetById if needed later
// export async function deleteRowInSheetById(...) { ... }
// ============================================================
// END OF FILE: lib/google/sheets.ts
// ============================================================