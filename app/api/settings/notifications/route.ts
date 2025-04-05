import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import mongoose from 'mongoose';

// --- GET (Buscar preferências) ---
export async function GET(request: Request) {
     try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        await connectToDatabase();
        const user = await User.findById(session.user.id).select('notificationPreferences');

        if (!user) {
             return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        // Retorna as preferências ou um objeto padrão se não existirem
        return NextResponse.json(user.notificationPreferences || {
            emailDespesasVencer: true,
            emailDocumentosNovos: true,
            emailRelatoriosSemanais: false,
            systemDespesasVencer: true,
            systemDocumentosNovos: true,
            systemEventosCalendario: true,
            antecedenciaVencimento: 3,
        });

    } catch (error) {
        console.error('Erro ao buscar preferências de notificação:', error);
        return NextResponse.json({ error: 'Erro interno ao buscar preferências' }, { status: 500 });
    }
}

// --- PUT (Atualizar preferências) ---
export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        // Validar os dados recebidos (tipos boolean e number)
        const {
            emailDespesasVencer, emailDocumentosNovos, emailRelatoriosSemanais,
            systemDespesasVencer, systemDocumentosNovos, systemEventosCalendario,
            antecedenciaVencimento
        } = body;

        // Validação simples (pode ser mais robusta com Zod no backend)
        if (typeof emailDespesasVencer !== 'boolean' || typeof emailDocumentosNovos !== 'boolean' ||
            typeof emailRelatoriosSemanais !== 'boolean' || typeof systemDespesasVencer !== 'boolean' ||
            typeof systemDocumentosNovos !== 'boolean' || typeof systemEventosCalendario !== 'boolean' ||
            typeof antecedenciaVencimento !== 'number' || antecedenciaVencimento < 0) {
            return NextResponse.json({ error: 'Dados de preferências inválidos.' }, { status: 400 });
        }


        const updateData = {
            notificationPreferences: {
                emailDespesasVencer, emailDocumentosNovos, emailRelatoriosSemanais,
                systemDespesasVencer, systemDocumentosNovos, systemEventosCalendario,
                antecedenciaVencimento
            },
            updatedAt: new Date()
        };


        await connectToDatabase();
        const updatedUser = await User.findByIdAndUpdate(
            session.user.id,
            { $set: updateData }, // Usa $set para atualizar apenas o campo
            { new: true, runValidators: true }
        ).select('notificationPreferences'); // Retorna as prefs atualizadas


        if (!updatedUser) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        return NextResponse.json({ preferences: updatedUser.notificationPreferences, message: 'Preferências atualizadas com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar preferências de notificação:', error);
        return NextResponse.json({ error: 'Erro interno ao atualizar preferências' }, { status: 500 });
    }
}