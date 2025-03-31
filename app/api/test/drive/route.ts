import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google/drive';

export async function GET() {
  try {
    const drive = getDriveClient();
    await drive.files.list({ pageSize: 1 });
    return NextResponse.json({ success: true, message: 'Google Drive conectado' });
  } catch (error) {
    console.error('Erro ao conectar ao Google Drive:', error);
    return NextResponse.json({ success: false, error: 'Falha ao conectar ao Google Drive' }, { status: 500 });
  }
}