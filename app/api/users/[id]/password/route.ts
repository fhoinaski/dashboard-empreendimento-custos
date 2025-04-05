import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { hash } from 'bcryptjs';
import mongoose from 'mongoose';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    console.log(`[API PUT /api/users/${id}/password] Received request.`);
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.warn(`[API PUT /password] Unauthorized: No session.`);
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        if (session.user.role !== 'admin') {
            console.warn(`[API PUT /password] Forbidden: User ${session.user.id} (${session.user.role}) is not an admin.`);
            return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
        }
        console.log(`[API PUT /password] Authorized Admin: ${session.user.id}`);

        if (!mongoose.isValidObjectId(id)) {
            console.error(`[API PUT /password] Invalid target user ID format: ${id}`);
            return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 });
        }
        console.log(`[API PUT /password] Valid target ID: ${id}`);

        if (session.user.id === id) {
            console.warn(`[API PUT /password] Admin ${session.user.id} attempted to change own password via admin route.`);
            return NextResponse.json({ error: 'Administradores devem alterar sua própria senha na página de perfil.' }, { status: 400 });
        }

        let newPassword: string;
        try {
            const body = await request.json();
            newPassword = body.password;
            console.log(`[API PUT /password] Request body parsed.`);
        } catch (e) {
            console.error(`[API PUT /password] Error parsing request body:`, e);
            return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
            console.error(`[API PUT /password] Invalid new password provided.`);
            return NextResponse.json({ error: 'Nova senha é obrigatória e deve ter no mínimo 6 caracteres.' }, { status: 400 });
        }
        console.log(`[API PUT /password] New password validation passed.`);

        await connectToDatabase();
        console.log(`[API PUT /password] DB Connected.`);

        const targetUser = await User.findById(id);
        if (!targetUser) {
            console.error(`[API PUT /password] Target user not found: ${id}`);
            return NextResponse.json({ error: 'Usuário alvo não encontrado' }, { status: 404 });
        }
        console.log(`[API PUT /password] Target user ${id} found: ${targetUser.email}`);

        console.log(`[API PUT /password] Hashing new password for user ${id}...`);
        const hashedNewPassword = await hash(newPassword, 12);
        console.log(`[API PUT /password] New password hashed.`);

        targetUser.password = hashedNewPassword;
        targetUser.updatedAt = new Date();
        await targetUser.save();
        console.log(`[API PUT /password] Password updated successfully for user ${id}.`);

        return NextResponse.json({ message: `Senha do usuário ${targetUser.name} atualizada com sucesso.` }, { status: 200 });

    } catch (error) {
        console.error(`[API PUT /api/users/${id}/password] Error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor ao alterar senha do usuário';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}