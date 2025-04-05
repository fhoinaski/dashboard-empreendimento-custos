import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { compare, hash } from 'bcryptjs';
import mongoose from 'mongoose';

export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return NextResponse.json({ error: 'Senha atual e nova senha (mínimo 6 caracteres) são obrigatórias.' }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findById(session.user.id);
        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        // Verificar senha atual
        const passwordIsValid = await compare(currentPassword, user.password);
        if (!passwordIsValid) {
            return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
        }

        // Criptografar nova senha
        const hashedNewPassword = await hash(newPassword, 12);

        // Atualizar senha no banco
        user.password = hashedNewPassword;
        user.updatedAt = new Date();
        await user.save();

        return NextResponse.json({ message: 'Senha atualizada com sucesso' });

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        return NextResponse.json({ error: 'Erro interno ao alterar senha' }, { status: 500 });
    }
}