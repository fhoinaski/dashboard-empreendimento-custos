// FILE: lib/google/sheets.ts
// STATUS: MODIFIED (Data Formatting)

import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getDriveClient } from './drive';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração de ambiente e cliente (sem alterações)
const SHARED_USER_EMAIL = 'sukinodoncai@gmail.com';
const DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

export const getSheetClient = () => {
  // console.log('Inicializando cliente do Google Sheets');
  const auth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

// --- createEmpreendimentoSheet (No changes needed for this request) ---
export async function createEmpreendimentoSheet(empreendimentoId: string, empreendimentoName: string, retries = 2) {
    const sheets = getSheetClient();
    const drive = getDriveClient();
    console.log(`[Sheets] createEmpreendimentoSheet: Iniciando para Empr. ID ${empreendimentoId}, Nome: ${empreendimentoName}`);

    if (!DRIVE_ROOT_FOLDER_ID) {
         console.error("[Sheets] createEmpreendimentoSheet: GOOGLE_DRIVE_ROOT_FOLDER_ID não definido!");
         throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID não definido');
    }

    try {
      // Criar a planilha
      console.log("[Sheets] createEmpreendimentoSheet: Criando planilha...");
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: `Despesas - ${empreendimentoName}` },
          sheets: [{ properties: { title: 'Despesas' } }],
        },
      });

      const spreadsheetId = response.data.spreadsheetId;
      if (!spreadsheetId) {
           console.error("[Sheets] createEmpreendimentoSheet: ID da planilha não retornado pela API.");
           throw new Error('ID da planilha não retornado');
      }
      console.log(`[Sheets] createEmpreendimentoSheet: Planilha criada com ID: ${spreadsheetId}`);

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      const sheetId = response.data.sheets?.[0]?.properties?.sheetId;
      if (sheetId === undefined || sheetId === null) {
          console.error("[Sheets] createEmpreendimentoSheet: Não foi possível obter o sheetId numérico da aba 'Despesas'.");
          throw new Error('Não foi possível obter o sheetId numérico da aba criada');
      }
       console.log(`[Sheets] createEmpreendimentoSheet: SheetId numérico da aba 'Despesas': ${sheetId}`);

      // Adicionar cabeçalhos
      const headersRange = 'Despesas!A1:I1';
      console.log(`[Sheets] createEmpreendimentoSheet: Adicionando cabeçalhos no range ${headersRange}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: headersRange, valueInputOption: 'RAW',
        requestBody: { values: [['ID', 'Descrição', 'Valor', 'Data', 'Vencimento', 'Status', 'Categoria', 'Método Pagamento', 'Observações']] },
      });

      // Formatar cabeçalhos
      console.log(`[Sheets] createEmpreendimentoSheet: Formatando cabeçalhos para sheetId ${sheetId}`);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)', }, }], }, });

      // Configurar permissões
      console.log(`[Sheets] createEmpreendimentoSheet: Configurando permissão de escrita para ${SHARED_USER_EMAIL}`);
      await drive.permissions.create({ fileId: spreadsheetId, requestBody: { role: 'writer', type: 'user', emailAddress: SHARED_USER_EMAIL, }, sendNotificationEmail: false, fields: 'id', });

      // Mover planilha para a pasta raiz
      console.log(`[Sheets] createEmpreendimentoSheet: Movendo planilha ${spreadsheetId} para a pasta raiz ${DRIVE_ROOT_FOLDER_ID}`);
      await drive.files.update({ fileId: spreadsheetId, addParents: DRIVE_ROOT_FOLDER_ID, fields: 'id, parents', });

      // Criar atalho (opcional)
      console.log(`[Sheets] createEmpreendimentoSheet: Criando atalho no 'Meu Drive' de ${SHARED_USER_EMAIL}`);
      await drive.files.create({ requestBody: { name: `Despesas - ${empreendimentoName}`, mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: spreadsheetId }, }, fields: 'id', });

      console.log(`[Sheets] createEmpreendimentoSheet: Planilha ${spreadsheetId} criada e integrada com sucesso.`);
      return { success: true, spreadsheetId, url: spreadsheetUrl };

    } catch (error: any) {
        console.error('[Sheets] createEmpreendimentoSheet: Erro:', error.message || error);
        if (error.response?.data?.error) console.error('[Sheets] Detalhes Google API:', JSON.stringify(error.response.data.error, null, 2));
        if (retries > 0) {
            console.log(`[Sheets] createEmpreendimentoSheet: Tentando novamente (${retries} restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            return createEmpreendimentoSheet(empreendimentoId, empreendimentoName, retries - 1);
        }
        const errorMessage = error.response?.data?.error?.message || error.message || 'Falha';
        return { success: false, error: `Falha ao criar planilha: ${errorMessage}` };
    }
}

// --- addDespesaToSheet (MODIFIED Formatting) ---
export async function addDespesaToSheet(spreadsheetId: string, despesa: any, retries = 2) {
    const sheets = getSheetClient();
    try {
        console.log(`[Sheets Lib] addDespesaToSheet: Tentando adicionar ${despesa._id} à planilha ${spreadsheetId}`);

        // **Format data explicitly before sending**
        const formattedDate = despesa.date instanceof Date ? format(despesa.date, 'dd/MM/yyyy', { locale: ptBR }) : '';
        const formattedDueDate = despesa.dueDate instanceof Date ? format(despesa.dueDate, 'dd/MM/yyyy', { locale: ptBR }) : '';
        // Send value as number
        const numericValue = typeof despesa.value === 'number' ? despesa.value : 0;

        const values = [[
            despesa._id?.toString() || '', // Ensure ID is string
            despesa.description || '',
            numericValue,                // Send number
            formattedDate,               // Send formatted date string
            formattedDueDate,            // Send formatted date string
            despesa.status || '',
            despesa.category || '',
            despesa.paymentMethod || '',
            despesa.notes || '',
        ]];

        console.log(`[Sheets Lib] addDespesaToSheet: Valores formatados a serem enviados:`, JSON.stringify(values[0]));

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Despesas!A:I', // Adjust if sheet name is different
            valueInputOption: 'USER_ENTERED', // Let Sheets interpret types
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values },
        });

        console.log(`[Sheets Lib] addDespesaToSheet: Resposta API append para ${despesa._id}:`, response.status, response.data.updates?.updatedRange);
        return { success: true, updatedRange: response.data.updates?.updatedRange };
    } catch (error: any) {
        console.error(`[Sheets Lib] addDespesaToSheet: Erro na planilha ${spreadsheetId} para ID ${despesa._id}:`, error.message);
        if (error.response?.data?.error) { console.error('[Sheets Lib] Detalhes erro Google API (add):', JSON.stringify(error.response.data.error, null, 2)); }
        if (retries > 0) {
            console.log(`[Sheets Lib] addDespesaToSheet: Tentando novamente para ${despesa._id} (${retries} restantes)`);
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500)); // Add jitter
            return addDespesaToSheet(spreadsheetId, despesa, retries - 1);
        }
        const errorMessage = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
        return { success: false, error: `Falha ao adicionar despesa à planilha: ${errorMessage}` };
    }
}

// --- updateDespesaInSheet (MODIFIED Formatting) ---
export async function updateDespesaInSheet(spreadsheetId: string, despesaId: string, despesa: any, retries = 2) {
    const sheets = getSheetClient();
    try {
        console.log(`[Sheets Lib] updateDespesaInSheet: Buscando linha para ID ${despesaId} na planilha ${spreadsheetId}`);
        const rangeToSearch = 'Despesas!A:A'; // Search only in the ID column
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeToSearch });
        const rows = response.data.values || [];
        let rowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i][0] === despesaId) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            console.warn(`[Sheets Lib] updateDespesaInSheet: ID ${despesaId} não encontrado para atualização. Tentando adicionar...`);
             // If not found, try adding it instead (e.g., after approval)
             return addDespesaToSheet(spreadsheetId, { ...despesa, _id: despesaId });
        }
        const rowNumber = rowIndex + 1; // Sheets row number is 1-based
        console.log(`[Sheets Lib] updateDespesaInSheet: Linha encontrada: ${rowNumber}`);

        // **Format data explicitly before sending**
        const formattedDate = despesa.date instanceof Date ? format(despesa.date, 'dd/MM/yyyy', { locale: ptBR }) : '';
        const formattedDueDate = despesa.dueDate instanceof Date ? format(despesa.dueDate, 'dd/MM/yyyy', { locale: ptBR }) : '';
        const numericValue = typeof despesa.value === 'number' ? despesa.value : 0;

        const values = [[
            despesaId, // Keep ID in the first column
            despesa.description || '',
            numericValue,
            formattedDate,
            formattedDueDate,
            despesa.status || '',
            despesa.category || '',
            despesa.paymentMethod || '',
            despesa.notes || '',
        ]];
        console.log(`[Sheets Lib] updateDespesaInSheet: Valores formatados para update na linha ${rowNumber}:`, JSON.stringify(values[0]));

        const updateRange = `Despesas!A${rowNumber}:I${rowNumber}`; // Update the found row
        const updateResponse = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        console.log(`[Sheets Lib] updateDespesaInSheet: Resposta API update para ${despesaId}:`, updateResponse.status, updateResponse.data.updatedCells);
        return { success: true, updatedRow: rowNumber };
    } catch (error: any) {
        console.error(`[Sheets Lib] updateDespesaInSheet: Erro na planilha ${spreadsheetId} para ID ${despesaId}:`, error.message);
        if (error.response?.data?.error) { console.error('[Sheets Lib] Detalhes erro Google API (update):', JSON.stringify(error.response.data.error, null, 2)); }
        if (retries > 0) {
            console.log(`[Sheets Lib] updateDespesaInSheet: Tentando novamente para ${despesaId} (${retries} restantes)`);
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500)); // Add jitter
            return updateDespesaInSheet(spreadsheetId, despesaId, despesa, retries - 1);
        }
        const errorMessage = error.response?.data?.error?.message || error.message || 'Erro desconhecido';
        return { success: false, error: `Falha ao atualizar despesa na planilha: ${errorMessage}` };
    }
}

// --- deleteDespesaFromSheet (No changes needed for this request) ---
export async function deleteDespesaFromSheet(spreadsheetId: string, despesaId: string, retries = 2) {
     const sheets = getSheetClient();
     console.log(`[Sheets] deleteDespesaFromSheet: Iniciando exclusão para despesa ${despesaId} na planilha ${spreadsheetId}`);
     try {
         console.log(`[Sheets] deleteDespesaFromSheet: Buscando linha para ID ${despesaId} na coluna A`);
         const rangeToSearch = 'Despesas!A:A';
         const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeToSearch });
         const rows = response.data.values || [];
         let rowIndex = -1;
         for (let i = 0; i < rows.length; i++) { if (rows[i] && rows[i][0] === despesaId) { rowIndex = i; break; } }

         if (rowIndex === -1) {
             console.warn(`[Sheets] deleteDespesaFromSheet: Despesa ${despesaId} NÃO encontrada na planilha ${spreadsheetId} para exclusão.`);
             return { success: false, error: 'Despesa não encontrada na planilha para exclusão' };
         }
         const rowNumber = rowIndex + 1;
         console.log(`[Sheets] deleteDespesaFromSheet: Despesa ${despesaId} encontrada na linha ${rowNumber} (índice ${rowIndex})`);

         console.log("[Sheets] deleteDespesaFromSheet: Obtendo sheetId numérico...");
         const sheetsResponse = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
         const sheet = sheetsResponse.data.sheets?.find(s => s.properties?.title === 'Despesas');
         const sheetId = sheet?.properties?.sheetId;
         if (sheetId === undefined || sheetId === null) {
             console.error("[Sheets] deleteDespesaFromSheet: Não foi possível encontrar o sheetId numérico da aba 'Despesas'.");
             return { success: false, error: 'ID numérico da aba "Despesas" não encontrado' };
         }
         console.log(`[Sheets] deleteDespesaFromSheet: SheetId numérico encontrado: ${sheetId}`);

         console.log(`[Sheets] deleteDespesaFromSheet: Chamando API batchUpdate para excluir linha índice ${rowIndex}`);
         await sheets.spreadsheets.batchUpdate({
             spreadsheetId,
             requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }], },
         });

         console.log(`[Sheets] deleteDespesaFromSheet: Linha ${rowNumber} (índice ${rowIndex}) excluída com sucesso para despesa ${despesaId}.`);
         return { success: true, deletedRow: rowNumber };
     } catch (error: any) {
         console.error(`[Sheets] deleteDespesaFromSheet: Erro ao excluir despesa ${despesaId}:`, error.message || error);
         if (error.response?.data?.error) console.error('[Sheets] Detalhes erro Google API (deleteDespesa):', JSON.stringify(error.response.data.error, null, 2));
         if (retries > 0) {
             console.log(`[Sheets] deleteDespesaFromSheet: Tentando novamente para ${despesaId} (${retries} restantes)...`);
             await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500)); // Add jitter
             return deleteDespesaFromSheet(spreadsheetId, despesaId, retries - 1);
         }
         const errorMessage = error.response?.data?.error?.message || error.message || 'Falha';
         return { success: false, error: `Falha ao excluir despesa da planilha: ${errorMessage}` };
     }
}