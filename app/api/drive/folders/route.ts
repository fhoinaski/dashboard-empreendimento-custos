// FILE: app/api/drive/folders/route.ts (Refatorado com RBAC)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { createEmpreendimentoFolders, listFilesInFolder } from '@/lib/google/drive';

// GET - Listar arquivos de uma pasta (Restrito a Admin/Manager)
export async function GET(request: Request) {
  console.log("[API GET /api/drive/folders] Requisição recebida.");
  try {
    // --- Verificação de Sessão e RBAC (Admin/Manager) ---
    const session = await getServerSession(authOptions);
    // Verifica se há sessão e se o usuário tem ID e Role definidos
    if (!session?.user?.id || !session.user.role) {
      console.warn("[API GET /api/drive/folders] Tentativa de acesso não autorizada (sem sessão válida).");
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verifica se a role é Admin ou Manager
    if (!['admin', 'manager'].includes(session.user.role)) {
        console.warn(`[API GET /api/drive/folders] Acesso negado. User: ${session.user.id}, Role: ${session.user.role}`);
        return NextResponse.json({ error: 'Acesso restrito a administradores e gerentes.' }, { status: 403 });
    }
    console.log(`[API GET /api/drive/folders] Acesso autorizado para ${session.user.role} ${session.user.id}.`);
    // --- Fim Verificação ---

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      console.log("[API GET /api/drive/folders] ID da pasta não fornecido.");
      return NextResponse.json({ error: 'ID da pasta não fornecido' }, { status: 400 });
    }
    console.log(`[API GET /api/drive/folders] Listando arquivos para folderId: ${folderId}`);

    // Listar arquivos da pasta
    const result = await listFilesInFolder(folderId);

    if (!result.success) {
      console.error(`[API GET /api/drive/folders] Erro ao listar arquivos do Drive: ${result.error}`);
      return NextResponse.json({ error: result.error || 'Erro ao listar arquivos da pasta do Drive' }, { status: 500 });
    }

    console.log(`[API GET /api/drive/folders] Arquivos listados com sucesso para folderId: ${folderId}.`);
    return NextResponse.json({ files: result.files });

  } catch (error) {
    console.error('[API GET /api/drive/folders] Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno ao listar arquivos da pasta' }, { status: 500 });
  }
}

// POST - Criar estrutura de pastas para um empreendimento (Restrito a Admin)
export async function POST(request: Request) {
  console.log("[API POST /api/drive/folders] Requisição recebida.");
  try {
    // --- Verificação de Sessão e RBAC (Admin Only) ---
    const session = await getServerSession(authOptions);
    // Verifica se há sessão e se o usuário tem ID e Role definidos
    if (!session?.user?.id || !session.user.role) {
        console.warn("[API POST /api/drive/folders] Tentativa de acesso não autorizada (sem sessão válida).");
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verifica se a role é Admin
    if (session.user.role !== 'admin') {
        console.warn(`[API POST /api/drive/folders] Acesso negado. User: ${session.user.id}, Role: ${session.user.role}`);
        return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }
    console.log(`[API POST /api/drive/folders] Acesso autorizado para Admin ${session.user.id}.`);
    // --- Fim Verificação ---

    const body = await request.json();
    const { empreendimentoId } = body;

    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) {
      console.log("[API POST /api/drive/folders] ID de empreendimento inválido:", empreendimentoId);
      return NextResponse.json({ error: 'ID de empreendimento inválido ou não fornecido' }, { status: 400 });
    }
    console.log(`[API POST /api/drive/folders] Tentando criar pastas para empreendimentoId: ${empreendimentoId}`);

    await connectToDatabase();

    const empreendimento = await Empreendimento.findById(empreendimentoId);
    if (!empreendimento) {
      console.log(`[API POST /api/drive/folders] Empreendimento ${empreendimentoId} não encontrado.`);
      return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
    }

    if (empreendimento.folderId) {
      console.log(`[API POST /api/drive/folders] Empreendimento ${empreendimentoId} já possui folderId: ${empreendimento.folderId}`);
      return NextResponse.json({ error: 'Empreendimento já possui uma pasta no Google Drive', folderId: empreendimento.folderId }, { status: 400 });
    }

    console.log(`[API POST /api/drive/folders] Chamando createEmpreendimentoFolders para ${empreendimento.name}`);
    const result = await createEmpreendimentoFolders(empreendimentoId, empreendimento.name);

    if (!result.success) {
      console.error(`[API POST /api/drive/folders] Erro ao criar pastas no Drive: ${result.error}`);
      return NextResponse.json({ error: result.error || 'Erro ao criar pastas no Google Drive' }, { status: 500 });
    }
    console.log(`[API POST /api/drive/folders] Pastas criadas. FolderId principal: ${result.empreendimentoFolderId}`);

    // Atualizar o empreendimento com o ID da pasta principal
    await Empreendimento.findByIdAndUpdate(empreendimentoId, { folderId: result.empreendimentoFolderId });
    console.log(`[API POST /api/drive/folders] Empreendimento ${empreendimentoId} atualizado com folderId.`);

    return NextResponse.json({
      message: 'Estrutura de pastas criada com sucesso',
      folderId: result.empreendimentoFolderId,
      categoryFolders: result.categoryFolders, // Retorna os IDs das subpastas se necessário
    });

  } catch (error) {
    console.error('[API POST /api/drive/folders] Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno ao criar estrutura de pastas' }, { status: 500 });
  }
}