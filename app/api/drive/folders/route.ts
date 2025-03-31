import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { createEmpreendimentoFolders, listFilesInFolder } from '@/lib/google/drive';

// GET - Listar arquivos de uma pasta
export async function GET(request: Request) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    // Obter parâmetros de consulta
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    
    if (!folderId) {
      return NextResponse.json(
        { error: 'ID da pasta não fornecido' },
        { status: 400 }
      );
    }
    
    // Listar arquivos da pasta
    const result = await listFilesInFolder(folderId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Erro ao listar arquivos da pasta' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      files: result.files,
    });
  } catch (error) {
    console.error('Erro ao listar arquivos da pasta:', error);
    return NextResponse.json(
      { error: 'Erro ao listar arquivos da pasta' },
      { status: 500 }
    );
  }
}

// POST - Criar estrutura de pastas para um empreendimento
export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { empreendimentoId } = body;
    
    // Validar ID
    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) {
      return NextResponse.json(
        { error: 'ID de empreendimento inválido ou não fornecido' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Verificar se o empreendimento existe
    const empreendimento = await Empreendimento.findById(empreendimentoId);
    
    if (!empreendimento) {
      return NextResponse.json(
        { error: 'Empreendimento não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o empreendimento já tem uma pasta no Drive
    if (empreendimento.folderId) {
      return NextResponse.json(
        { error: 'Empreendimento já possui uma pasta no Google Drive', folderId: empreendimento.folderId },
        { status: 400 }
      );
    }
    
    // Criar estrutura de pastas no Google Drive
    const result = await createEmpreendimentoFolders(
      empreendimentoId,
      empreendimento.name
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Erro ao criar pastas no Google Drive' },
        { status: 500 }
      );
    }
    
    // Atualizar o empreendimento com o ID da pasta principal
    await Empreendimento.findByIdAndUpdate(empreendimentoId, {
      folderId: result.empreendimentoFolderId,
    });
    
    return NextResponse.json({
      message: 'Estrutura de pastas criada com sucesso',
      folderId: result.empreendimentoFolderId,
      categoryFolders: result.categoryFolders,
    });
  } catch (error) {
    console.error('Erro ao criar estrutura de pastas:', error);
    return NextResponse.json(
      { error: 'Erro ao criar estrutura de pastas' },
      { status: 500 }
    );
  }
}