// FILE: app/api/sheets/create/route.ts (Refatorado)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { createEmpreendimentoSheet } from '@/lib/google/sheets';

export async function POST(request: Request) {
  try {
    // --- Verificação de Sessão e RBAC (Admin Only) ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
        console.warn(`[API POST /api/sheets/create] Acesso negado. User: ${session?.user?.id}, Role: ${session?.user?.role}`);
        return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }
    // --- Fim Verificação ---

    const body = await request.json();
    const { empreendimentoId } = body;

    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) {
      return NextResponse.json({ error: 'ID de empreendimento inválido ou não fornecido' }, { status: 400 });
    }

    await connectToDatabase();
    const empreendimento = await Empreendimento.findById(empreendimentoId);
    if (!empreendimento) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
    if (empreendimento.sheetId) return NextResponse.json({ error: 'Empreendimento já possui uma planilha', sheetId: empreendimento.sheetId }, { status: 400 });

    const result = await createEmpreendimentoSheet(empreendimentoId, empreendimento.name);
    if (!result.success) return NextResponse.json({ error: result.error || 'Erro interno ao criar planilha Google' }, { status: 500 });

    // Atualiza o empreendimento com o ID da planilha
    await Empreendimento.findByIdAndUpdate(empreendimentoId, { sheetId: result.spreadsheetId });

    return NextResponse.json({ message: 'Planilha criada com sucesso', sheetId: result.spreadsheetId, url: result.url });
  } catch (error) {
    console.error('[API POST /api/sheets/create] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao criar planilha' }, { status: 500 });
  }
}