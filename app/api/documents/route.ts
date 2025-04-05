// FILE: app/api/documents/route.ts (Refatorado)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types } from 'mongoose'; // Importar Types
import connectToDatabase from '@/lib/db/mongodb';
import { Documento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';

export async function GET(request: Request) {
  try {
    // --- Verificação de Sessão e RBAC ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        console.warn("[API GET /api/documents] Acesso não autorizado.");
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userRole = session.user.role;
    const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];
    // --- Fim Verificação ---

    const { searchParams } = new URL(request.url);
    const empreendimentoId = searchParams.get('empreendimentoId');

    if (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId)) {
      return NextResponse.json({ error: 'ID de empreendimento inválido' }, { status: 400 });
    }

    // --- Verificação de Permissão para o Empreendimento Específico ---
    const canAccess = userRole === 'admin' || userRole === 'manager' || (userRole === 'user' && userAssignedEmpreendimentos.includes(empreendimentoId));

    if (!canAccess) {
        console.warn(`[API GET /api/documents] Usuário ${session.user.id} (${userRole}) sem permissão para empreendimento ${empreendimentoId}`);
        return NextResponse.json({ error: 'Acesso negado a este empreendimento' }, { status: 403 });
    }
    // --- Fim Verificação de Permissão ---

    await connectToDatabase();
    // A query agora é segura, pois o acesso ao empreendimento foi validado
    const documents = await Documento.find({ empreendimento: empreendimentoId }).lean();

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[API GET /api/documents] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar documentos' }, { status: 500 });
  }
}