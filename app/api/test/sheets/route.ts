// app/api/create-test-sheet/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export async function GET() {
  try {
    // 1. Autenticação
    const auth = new JWT({
      email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });

    const serviceAccountEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    if (!serviceAccountEmail) throw new Error('Service account email not defined in environment variables');

    // 2. Criação da planilha
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Teste',
        },
        sheets: [{
          properties: {
            title: 'Página1',
            sheetId: 0,
            gridProperties: {
              rowCount: 100,
              columnCount: 10,
            },
          },
        }],
      },
    });

    const spreadsheetId = response.data.spreadsheetId;
    if (!spreadsheetId) throw new Error('Spreadsheet ID not found');
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 3. Compartilhamento com sukinodoncai@gmail.com como editor
    try {
      // Adicionar como editor
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          role: 'writer', // Editor
          type: 'user',
          emailAddress: 'sukinodoncai@gmail.com',
        },
        sendNotificationEmail: false, // Acesso imediato, sem notificação
        fields: 'id',
      });

      console.log(`Permissão de escrita e gerenciamento concedida para sukinodoncai@gmail.com na planilha ${spreadsheetId}`);

      // Adicionar a planilha ao "Meu Drive" de sukinodoncai@gmail.com
      await drive.files.create({
        requestBody: {
          name: 'Teste', // Nome do atalho
          mimeType: 'application/vnd.google-apps.shortcut',
          shortcutDetails: {
            targetId: spreadsheetId, // ID da planilha original
          },
          parents: ['root'], // Adiciona ao "Meu Drive" (root)
        },
        fields: 'id',
      });

      console.log(`Planilha adicionada ao "Meu Drive" de sukinodoncai@gmail.com como atalho`);

      // Verificação das permissões
      const permissions = await drive.permissions.list({
        fileId: spreadsheetId,
        fields: 'permissions(id, emailAddress, role)',
      });
      console.log('Permissões atuais:', JSON.stringify(permissions.data.permissions, null, 2));
    } catch (permError) {
      console.error('Erro ao configurar permissões ou adicionar ao Meu Drive:', permError);
      throw new Error('Falha ao compartilhar a planilha ou adicionar ao Meu Drive');
    }

    // 4. Adiciona cabeçalhos (opcional)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Página1!A1:C1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Coluna A', 'Coluna B', 'Coluna C']],
      },
    });

    return NextResponse.json({
      success: true,
      spreadsheetId,
      url: spreadsheetUrl,
      message: 'Planilha "Teste" criada, sukinodoncai@gmail.com adicionado como editor e planilha adicionada ao "Meu Drive" como atalho!',
    });
  } catch (error) {
    console.error('Erro ao criar ou configurar permissões da planilha:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Falha ao criar ou configurar permissões da planilha',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}