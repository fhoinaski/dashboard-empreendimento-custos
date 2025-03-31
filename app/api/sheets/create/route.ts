import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { createEmpreendimentoSheet } from '@/lib/google/sheets';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

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
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

    await Empreendimento.findByIdAndUpdate(empreendimentoId, { sheetId: result.spreadsheetId });

    return NextResponse.json({ message: 'Planilha criada com sucesso', sheetId: result.spreadsheetId, url: result.url });
  } catch (error) {
    console.error('Erro ao criar planilha:', error);
    return NextResponse.json({ error: 'Erro ao criar planilha' }, { status: 500 });
  }
}