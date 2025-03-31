import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getDriveClient } from './drive';
import { format } from 'date-fns'; // Importar format
import { ptBR } from 'date-fns/locale'; // Importar locale ptBR

// Configuração de ambiente
const SHARED_USER_EMAIL = 'sukinodoncai@gmail.com'; // Email para compartilhamento
const DRIVE_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID; // Pasta raíz no Drive

// Cliente do Google Sheets
export const getSheetClient = () => {
  console.log('Inicializando cliente do Google Sheets');
  const auth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

// Criar uma nova planilha (Adicionando logs)
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
        sheets: [{ properties: { title: 'Despesas' } }], // Nome da aba
      },
    });

    const spreadsheetId = response.data.spreadsheetId;
    if (!spreadsheetId) {
         console.error("[Sheets] createEmpreendimentoSheet: ID da planilha não retornado pela API.");
         throw new Error('ID da planilha não retornado');
    }
    console.log(`[Sheets] createEmpreendimentoSheet: Planilha criada com ID: ${spreadsheetId}`);

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Obter o sheetId numérico da aba "Despesas"
    const sheetId = response.data.sheets?.[0]?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) { // Checa undefined e null explicitamente
        console.error("[Sheets] createEmpreendimentoSheet: Não foi possível obter o sheetId numérico da aba 'Despesas'.");
        throw new Error('Não foi possível obter o sheetId numérico da aba criada');
    }
     console.log(`[Sheets] createEmpreendimentoSheet: SheetId numérico da aba 'Despesas': ${sheetId}`);

    // Adicionar cabeçalhos
    const headersRange = 'Despesas!A1:I1'; // Nome da aba correto
    console.log(`[Sheets] createEmpreendimentoSheet: Adicionando cabeçalhos no range ${headersRange}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headersRange,
      valueInputOption: 'RAW', // RAW para cabeçalhos simples
      requestBody: {
        values: [['ID', 'Descrição', 'Valor', 'Data', 'Vencimento', 'Status', 'Categoria', 'Método Pagamento', 'Observações']], // Corrigido Método de Pagamento
      },
    });

    // Formatar cabeçalhos
    console.log(`[Sheets] createEmpreendimentoSheet: Formatando cabeçalhos para sheetId ${sheetId}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 }, // 9 colunas (A-I)
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        }],
      },
    });

    // Configurar permissões
    console.log(`[Sheets] createEmpreendimentoSheet: Configurando permissão de escrita para ${SHARED_USER_EMAIL}`);
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { role: 'writer', type: 'user', emailAddress: SHARED_USER_EMAIL, },
      sendNotificationEmail: false, fields: 'id',
    });

    // Mover planilha para a pasta raiz configurada no Drive
    console.log(`[Sheets] createEmpreendimentoSheet: Movendo planilha ${spreadsheetId} para a pasta raiz ${DRIVE_ROOT_FOLDER_ID}`);
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: DRIVE_ROOT_FOLDER_ID, // Adiciona à pasta raiz
      // removeParents: 'root', // Remove da raiz principal se necessário (opcional)
      fields: 'id, parents',
    });

    // Criar atalho no "Meu Drive" do usuário compartilhado (opcional, mas útil)
    console.log(`[Sheets] createEmpreendimentoSheet: Criando atalho no 'Meu Drive' de ${SHARED_USER_EMAIL}`);
    await drive.files.create({
      requestBody: {
        name: `Despesas - ${empreendimentoName}`, // Nome do atalho
        mimeType: 'application/vnd.google-apps.shortcut',
        shortcutDetails: { targetId: spreadsheetId },
        // parents: ['root'], // Adiciona ao 'Meu Drive' do usuário que executa (a conta de serviço), pode não ser necessário
      },
      fields: 'id',
    });

    console.log(`[Sheets] createEmpreendimentoSheet: Planilha ${spreadsheetId} criada, compartilhada e integrada ao Drive com sucesso.`);
    return { success: true, spreadsheetId, url: spreadsheetUrl };

  } catch (error: any) {
    console.error('[Sheets] createEmpreendimentoSheet: Erro ao criar planilha:', error.message || error);
     if (error.response?.data?.error) {
        console.error('[Sheets] Detalhes do erro Google API:', JSON.stringify(error.response.data.error, null, 2));
     }
    if (retries > 0) {
        console.log(`[Sheets] createEmpreendimentoSheet: Tentando novamente (${retries} restantes)...`);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Pausa maior para criação
        return createEmpreendimentoSheet(empreendimentoId, empreendimentoName, retries - 1);
    }
    const errorMessage = error.response?.data?.error?.message || error.message || 'Falha ao criar planilha Google Sheets';
    return { success: false, error: errorMessage };
  }
}

// Adicionar despesa à planilha (Com logs e formatação ajustada)
export async function addDespesaToSheet(spreadsheetId: string, despesa: any, retries = 2) {
  const sheets = getSheetClient();
  try {
      console.log(`Adicionando despesa ${despesa._id} à planilha ${spreadsheetId}`);
      const values = [[
          despesa._id,
          despesa.description,
          despesa.value.toFixed(2),
          new Date(despesa.date).toLocaleDateString('pt-BR'),
          new Date(despesa.dueDate).toLocaleDateString('pt-BR'),
          despesa.status,
          despesa.category,
          despesa.paymentMethod || '',
          despesa.notes || '',
      ]];
      console.log('Valores a serem enviados ao Google Sheets:', values);

      // Verificar se a aba "Despesas" existe
      const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetsList = sheetInfo.data.sheets || [];
      const despesaSheet = sheetsList.find(sheet => sheet.properties?.title === 'Despesas');
      if (!despesaSheet) {
          console.error(`Aba "Despesas" não encontrada na planilha ${spreadsheetId}`);
          return { success: false, error: 'Aba "Despesas" não existe na planilha' };
      }

      const response = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Despesas!A:I',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values },
      });

      console.log('Resposta da API do Google Sheets:', response.data);
      return { success: true, updatedRange: response.data.updates?.updatedRange };
  } catch (error) {
      console.error('Erro ao adicionar despesa à planilha:', error);
      if (retries > 0) {
          console.log(`Tentando novamente (${retries} restantes)`);
          return addDespesaToSheet(spreadsheetId, despesa, retries - 1);
      }
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: `Falha ao adicionar despesa à planilha: ${errorMessage}` };
  }
}


// Atualizar despesa na planilha (Com logs e formatação ajustada)
export async function updateDespesaInSheet(spreadsheetId: string, despesaId: string, despesa: any, retries = 2) {
    const sheets = getSheetClient();
    console.log(`[Sheets] updateDespesaInSheet: Iniciando atualização para despesa ${despesaId} na planilha ${spreadsheetId}`);
    try {
        // 1. Encontrar a linha da despesa pelo ID (Coluna A)
        console.log(`[Sheets] updateDespesaInSheet: Buscando linha para ID ${despesaId} na coluna A`);
        const rangeToSearch = 'Despesas!A:A';
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeToSearch });
        const rows = response.data.values || [];
        let rowIndex = -1; // Índice baseado em 0
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i][0] === despesaId) { // Verifica se a linha e a célula existem
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            console.warn(`[Sheets] updateDespesaInSheet: Despesa ${despesaId} NÃO encontrada na planilha ${spreadsheetId}`);
            return { success: false, error: 'Despesa não encontrada na planilha para atualização' };
        }
        const rowNumber = rowIndex + 1; // Número da linha na planilha (baseado em 1)
        console.log(`[Sheets] updateDespesaInSheet: Despesa ${despesaId} encontrada na linha ${rowNumber} (índice ${rowIndex})`);

        // 2. Formatar os novos valores
        const values = [[
            despesaId,
            despesa.description || '',
            typeof despesa.value === 'number' ? despesa.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(despesa.value || 0),
            despesa.date ? format(new Date(despesa.date), 'dd/MM/yyyy', { locale: ptBR }) : '',
            despesa.dueDate ? format(new Date(despesa.dueDate), 'dd/MM/yyyy', { locale: ptBR }) : '',
            despesa.status || '',
            despesa.category || '',
            despesa.paymentMethod || '',
            despesa.notes || '',
        ]];
        console.log(`[Sheets] updateDespesaInSheet: Novos valores para a linha ${rowNumber}:`, JSON.stringify(values[0]));

        // 3. Atualizar a linha encontrada
        const updateRange = `Despesas!A${rowNumber}:I${rowNumber}`; // Range A até I da linha específica
        console.log(`[Sheets] updateDespesaInSheet: Chamando API update para range ${updateRange}`);
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED', // Para que o Sheets interprete datas e números formatados
            requestBody: { values },
        });

        console.log(`[Sheets] updateDespesaInSheet: Despesa ${despesaId} atualizada com sucesso na linha ${rowNumber}`);
        return { success: true, updatedRow: rowNumber };

    } catch (error: any) {
        console.error(`[Sheets] updateDespesaInSheet: Erro ao atualizar despesa ${despesaId}:`, error.message || error);
        if (error.response?.data?.error) {
            console.error('[Sheets] Detalhes do erro Google API (updateDespesa):', JSON.stringify(error.response.data.error, null, 2));
        }
        if (retries > 0) {
            console.log(`[Sheets] updateDespesaInSheet: Tentando novamente para ${despesaId} (${retries} restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return updateDespesaInSheet(spreadsheetId, despesaId, despesa, retries - 1);
        }
        const errorMessage = error.response?.data?.error?.message || error.message || 'Falha ao atualizar despesa na planilha Google Sheets';
        return { success: false, error: errorMessage };
    }
}

// Excluir despesa da planilha (Com logs)
export async function deleteDespesaFromSheet(spreadsheetId: string, despesaId: string, retries = 2) {
    const sheets = getSheetClient();
    console.log(`[Sheets] deleteDespesaFromSheet: Iniciando exclusão para despesa ${despesaId} na planilha ${spreadsheetId}`);
    try {
        // 1. Encontrar a linha da despesa
        console.log(`[Sheets] deleteDespesaFromSheet: Buscando linha para ID ${despesaId} na coluna A`);
        const rangeToSearch = 'Despesas!A:A';
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeToSearch });
        const rows = response.data.values || [];
        let rowIndex = -1; // Índice baseado em 0
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i][0] === despesaId) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex === -1) {
            console.warn(`[Sheets] deleteDespesaFromSheet: Despesa ${despesaId} NÃO encontrada na planilha ${spreadsheetId} para exclusão.`);
            // Considerar sucesso se não encontrada? Ou retornar erro? Por ora, erro.
            return { success: false, error: 'Despesa não encontrada na planilha para exclusão' };
        }
        const rowNumber = rowIndex + 1;
        console.log(`[Sheets] deleteDespesaFromSheet: Despesa ${despesaId} encontrada na linha ${rowNumber} (índice ${rowIndex})`);

        // 2. Obter o sheetId numérico da aba 'Despesas'
        console.log("[Sheets] deleteDespesaFromSheet: Obtendo sheetId numérico...");
        const sheetsResponse = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' }); // Busca só o necessário
        const sheet = sheetsResponse.data.sheets?.find(s => s.properties?.title === 'Despesas');
        const sheetId = sheet?.properties?.sheetId;

        if (sheetId === undefined || sheetId === null) {
            console.error("[Sheets] deleteDespesaFromSheet: Não foi possível encontrar o sheetId numérico da aba 'Despesas'.");
            return { success: false, error: 'ID numérico da aba "Despesas" não encontrado' };
        }
         console.log(`[Sheets] deleteDespesaFromSheet: SheetId numérico encontrado: ${sheetId}`);

        // 3. Excluir a linha usando batchUpdate
        console.log(`[Sheets] deleteDespesaFromSheet: Chamando API batchUpdate para excluir linha índice ${rowIndex}`);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId, // Usa o ID numérico
                            dimension: 'ROWS',
                            startIndex: rowIndex, // Baseado em 0
                            endIndex: rowIndex + 1 // Exclui 1 linha a partir do startIndex
                        }
                    }
                }],
            },
        });

        console.log(`[Sheets] deleteDespesaFromSheet: Linha ${rowNumber} (índice ${rowIndex}) excluída com sucesso para despesa ${despesaId}.`);
        return { success: true, deletedRow: rowNumber };

    } catch (error: any) {
        console.error(`[Sheets] deleteDespesaFromSheet: Erro ao excluir despesa ${despesaId}:`, error.message || error);
         if (error.response?.data?.error) {
            console.error('[Sheets] Detalhes do erro Google API (deleteDespesa):', JSON.stringify(error.response.data.error, null, 2));
         }
        if (retries > 0) {
            console.log(`[Sheets] deleteDespesaFromSheet: Tentando novamente para ${despesaId} (${retries} restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return deleteDespesaFromSheet(spreadsheetId, despesaId, retries - 1);
        }
         const errorMessage = error.response?.data?.error?.message || error.message || 'Falha ao excluir despesa da planilha Google Sheets';
        return { success: false, error: errorMessage };
    }
}