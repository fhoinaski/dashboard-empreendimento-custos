import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Documento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToDrive, listFilesInFolder } from '@/lib/google/drive';

// Definir tipos para os arquivos do Google Drive
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  size?: string;
}



function convertDriveFiles(files: any[]): DriveFile[] {
    return files
      .filter(file => file.id && file.mimeType !== 'application/vnd.google-apps.folder')
      .map(file => ({
        id: file.id || '',
        name: file.name || 'Sem nome',
        mimeType: file.mimeType || '',
        webViewLink: file.webViewLink ?? undefined,
        webContentLink: file.webContentLink ?? undefined,
        createdTime: file.createdTime ?? undefined,
        size: file.size ?? undefined
      }));
  }
  

// GET - Listar documentos de um empreendimento
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    // Validar ID
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Verificar se o empreendimento existe
    const empreendimento = await Empreendimento.findById(id);
    
    if (!empreendimento) {
      return NextResponse.json(
        { error: 'Empreendimento não encontrado' },
        { status: 404 }
      );
    }
    
    // Buscar documentos pelo empreendimento
    const documentos = await Documento.find({ empreendimento: id })
      .sort({ createdAt: -1 });
    
    // Obter parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    
    // Se tiver uma categoria e o ID da pasta do Drive, buscar arquivos diretamente do Drive
    if (category && empreendimento.folderId) {
        const result = await listFilesInFolder(empreendimento.folderId);
        
        if (result.success && result.files) {
          const files = convertDriveFiles(result.files);
          
          return NextResponse.json({
            documentos,
            driveFiles: files
          });
        }
      }
    
    return NextResponse.json({ documentos });
  } catch (error) {
    console.error('Erro ao listar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar documentos' },
      { status: 500 }
    );
  }
}

// POST - Adicionar um documento ao empreendimento
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    // Validar ID
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    // Para upload de arquivos, precisamos usar formData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;
    const type = formData.get('type') as string | null;
    const category = formData.get('category') as string | null;
    
    if (!file || !name || !type) {
      return NextResponse.json(
        { error: 'Arquivo, nome e tipo são obrigatórios' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Verificar se o empreendimento existe
    const empreendimento = await Empreendimento.findById(id);
    
    if (!empreendimento) {
      return NextResponse.json(
        { error: 'Empreendimento não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o empreendimento tem uma pasta no Drive
    if (!empreendimento.folderId) {
      return NextResponse.json(
        { error: 'Empreendimento não possui pasta no Google Drive' },
        { status: 400 }
      );
    }
    
    // Converter o arquivo para buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Upload do arquivo para o Google Drive
    const uploadResult = await uploadFileToDrive(
      {
        buffer,
        originalname: file.name,
        mimetype: file.type
      },
      empreendimento.folderId,
      category || 'Outros'
    );
    
    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo para o Google Drive' },
        { status: 500 }
      );
    }
    
    // Salvar referência do documento no MongoDB
    const documento = await Documento.create({
      name,
      type,
      empreendimento: id,
      category: category || 'Outros',
      fileId: uploadResult.fileId,
      url: uploadResult.webViewLink,
      createdBy: session.user.email,
    });
    
    return NextResponse.json({
      documento,
      file: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        url: uploadResult.webViewLink,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao adicionar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao adicionar documento' },
      { status: 500 }
    );
  }
}