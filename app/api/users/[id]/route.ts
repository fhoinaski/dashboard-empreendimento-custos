import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento, UserDocument } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import mongoose, { Types } from 'mongoose';

interface UserUpdatePayload {
    name?: string;
    role?: 'admin' | 'manager' | 'user';
    assignedEmpreendimentos?: string[];
}

interface MongooseSetData {
    name?: string;
    role?: 'admin' | 'manager' | 'user';
    assignedEmpreendimentos?: Types.ObjectId[];
    updatedAt: Date;
}

// --- PUT Handler ---
export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> } // Tipagem ajustada para refletir a Promise
) {
    // Resolve os parâmetros dinâmicos de forma assíncrona
    const params = await context.params;
    const userIdToUpdate = params.id;

    console.log(`[API PUT /users/${userIdToUpdate}] Request recebida.`);

    if (!userIdToUpdate) {
        console.error('[API PUT /users] ID de usuário não fornecido nos parâmetros.');
        return NextResponse.json({ error: 'ID de usuário não fornecido' }, { status: 400 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            console.warn(`[API PUT /users/${userIdToUpdate}] Não autorizado.`);
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        if (!mongoose.isValidObjectId(userIdToUpdate)) {
            console.error(`[API PUT /users/${userIdToUpdate}] ID inválido: ${userIdToUpdate}`);
            return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 });
        }

        if (session.user.id === userIdToUpdate) {
            console.warn(`[API PUT /users/${userIdToUpdate}] Tentativa de auto-edição.`);
            return NextResponse.json({ error: 'Não é possível alterar o próprio usuário por esta rota.' }, { status: 400 });
        }

        let body: UserUpdatePayload;
        try {
            body = await request.json();
            console.log(`[API PUT /users/${userIdToUpdate}] Corpo recebido:`, JSON.stringify(body));
        } catch (e) {
            console.error(`[API PUT /users/${userIdToUpdate}] Erro ao parsear corpo:`, e);
            return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
        }

        const { role, name, assignedEmpreendimentos } = body;

        await connectToDatabase();
        console.log(`[API PUT /users/${userIdToUpdate}] Conectado ao DB.`);

        const updateFields: Partial<MongooseSetData> = {};
        let finalRole = role;

        if (!finalRole && assignedEmpreendimentos !== undefined) {
            const currentUser = await User.findById(userIdToUpdate).select('role').lean();
            finalRole = currentUser?.role;
            console.log(`[API PUT /users/${userIdToUpdate}] Role atual buscada: ${finalRole}`);
        } else if (role) {
            console.log(`[API PUT /users/${userIdToUpdate}] Usando role fornecida: ${role}`);
        } else {
            console.log(`[API PUT /users/${userIdToUpdate}] Role não fornecida e não necessária para lógica de empreendimentos.`);
        }

        if (name !== undefined) {
            if (typeof name === 'string' && name.trim().length >= 3) {
                updateFields.name = name.trim();
                console.log(`[API PUT /users/${userIdToUpdate}] Adicionando nome ao $set: ${name.trim()}`);
            } else {
                console.error(`[API PUT /users/${userIdToUpdate}] Nome inválido fornecido: "${name}"`);
                return NextResponse.json({ error: 'Nome inválido (mínimo 3 caracteres).' }, { status: 400 });
            }
        }

        if (role !== undefined) {
            if (!['admin', 'manager', 'user'].includes(role)) {
                console.error(`[API PUT /users/${userIdToUpdate}] Role inválido fornecido: ${role}`);
                return NextResponse.json({ error: 'Papel (role) inválido.' }, { status: 400 });
            }
            updateFields.role = role;
            console.log(`[API PUT /users/${userIdToUpdate}] Adicionando role ao $set: ${role}`);
        }

        if (assignedEmpreendimentos !== undefined) {
            console.log(`[API PUT /users/${userIdToUpdate}] Processando assignedEmpreendimentos para $set.`);
            let newAssignedObjectIds: Types.ObjectId[] = [];

            if (finalRole === 'user') {
                if (!Array.isArray(assignedEmpreendimentos)) {
                    console.error(`[API PUT /users/${userIdToUpdate}] assignedEmpreendimentos não é array.`);
                    return NextResponse.json({ error: '`assignedEmpreendimentos` deve ser um array.' }, { status: 400 });
                }
                for (const empId of assignedEmpreendimentos) {
                    if (!mongoose.isValidObjectId(empId)) {
                        console.error(`[API PUT /users/${userIdToUpdate}] ID de empreendimento inválido: ${empId}`);
                        return NextResponse.json({ error: `ID de empreendimento inválido: ${empId}` }, { status: 400 });
                    }
                    newAssignedObjectIds.push(new Types.ObjectId(empId));
                }
                if (newAssignedObjectIds.length > 0) {
                    const existingCount = await Empreendimento.countDocuments({ _id: { $in: newAssignedObjectIds } });
                    if (existingCount !== newAssignedObjectIds.length) {
                        console.error(`[API PUT /users/${userIdToUpdate}] Um ou mais empreendimentos não existem.`);
                        return NextResponse.json({ error: 'Um ou mais empreendimentos atribuídos não existem.' }, { status: 400 });
                    }
                }
                updateFields.assignedEmpreendimentos = newAssignedObjectIds;
                console.log(`[API PUT /users/${userIdToUpdate}] Adicionando assignedEmpreendimentos (user) ao $set:`, newAssignedObjectIds.map(id => id.toString()));
            } else {
                updateFields.assignedEmpreendimentos = [];
                console.log(`[API PUT /users/${userIdToUpdate}] Adicionando array vazio de assignedEmpreendimentos ao $set (role: ${finalRole})`);
            }
        } else {
            console.log(`[API PUT /users/${userIdToUpdate}] Chave 'assignedEmpreendimentos' não presente no corpo. Nenhuma alteração neste campo via $set.`);
        }

        if (Object.keys(updateFields).length === 0) {
            console.log(`[API PUT /users/${userIdToUpdate}] Nenhum campo para atualizar no $set.`);
            const currentUser = await User.findById(userIdToUpdate).populate({ path: 'assignedEmpreendimentos', select: 'name _id', options: { strictPopulate: false } });
            if (!currentUser) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
            const clientUserUnchanged = {
                _id: currentUser._id.toString(),
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role,
                assignedEmpreendimentos: Array.isArray(currentUser.assignedEmpreendimentos)
                    ? currentUser.assignedEmpreendimentos.map((emp: any) => ({ _id: emp._id.toString(), name: emp.name }))
                    : []
            };
            return NextResponse.json({ user: clientUserUnchanged, message: 'Nenhum dado alterado.' }, { status: 200 });
        }

        updateFields.updatedAt = new Date();
        const updateQuery = { $set: updateFields };

        console.log(`[API PUT /users/${userIdToUpdate}] Executando findByIdAndUpdate com query:`, JSON.stringify(updateQuery));

        const updatedUserDoc = await User.findByIdAndUpdate(
            userIdToUpdate,
            updateQuery,
            { new: true, runValidators: true }
        );

        if (!updatedUserDoc) {
            console.error(`[API PUT /users/${userIdToUpdate}] Usuário não encontrado no DB após tentativa de atualização.`);
            return NextResponse.json({ error: 'Usuário não encontrado para atualização' }, { status: 404 });
        }
        console.log(`[API PUT /users/${userIdToUpdate}] Atualização bem-sucedida via findByIdAndUpdate. Documento atualizado:`, JSON.stringify(updatedUserDoc.toObject()));

        const populatedUser: any = await User.populate(updatedUserDoc, {
            path: 'assignedEmpreendimentos',
            select: 'name _id',
            options: { strictPopulate: false }
        });

        const clientUser = {
            _id: populatedUser._id.toString(),
            name: populatedUser.name,
            email: populatedUser.email,
            role: populatedUser.role,
            assignedEmpreendimentos: Array.isArray(populatedUser.assignedEmpreendimentos)
                ? populatedUser.assignedEmpreendimentos.map((emp: any) => ({ _id: emp._id.toString(), name: emp.name }))
                : []
        };

        console.log(`[API PUT /users/${userIdToUpdate}] Enviando resposta com usuário atualizado.`);
        return NextResponse.json({ user: clientUser, message: 'Usuário atualizado com sucesso' });

    } catch (error) {
        console.error(`[API PUT /users/${userIdToUpdate}] Erro GERAL:`, error);
        const message = error instanceof Error ? error.message : 'Erro interno do servidor';
        if (error instanceof mongoose.Error.ValidationError) {
            console.error(`[API PUT /users/${userIdToUpdate}] Erro de validação Mongoose:`, error.errors);
            return NextResponse.json({ error: 'Erro de validação', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Erro interno ao atualizar usuário', details: message }, { status: 500 });
    }
}

// --- DELETE Handler ---
export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> } // Tipagem ajustada para Promise
) {
    const params = await context.params;
    const userIdToDelete = params.id;

    if (!userIdToDelete) {
        console.error('[API DELETE /users] ID de usuário não fornecido nos parâmetros.');
        return NextResponse.json({ error: 'ID de usuário não fornecido' }, { status: 400 });
    }
    console.log(`[API DELETE /users/${userIdToDelete}] Request recebida.`);

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            console.warn(`[API DELETE /users/${userIdToDelete}] Não autorizado.`);
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        if (!mongoose.isValidObjectId(userIdToDelete)) {
            console.error(`[API DELETE /users/${userIdToDelete}] ID inválido.`);
            return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 });
        }

        if (session.user.id === userIdToDelete) {
            console.warn(`[API DELETE /users/${userIdToDelete}] Tentativa de auto-exclusão.`);
            return NextResponse.json({ error: 'Não é possível excluir a si mesmo' }, { status: 400 });
        }

        await connectToDatabase();

        const userToDelete = await User.findById(userIdToDelete);
        if (!userToDelete) {
            console.error(`[API DELETE /users/${userIdToDelete}] Usuário não encontrado.`);
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }

        if (userToDelete.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                console.warn(`[API DELETE /users/${userIdToDelete}] Tentativa de excluir último admin.`);
                return NextResponse.json({ error: 'Não é possível excluir o último administrador' }, { status: 400 });
            }
        }

        const deletedUser = await User.findByIdAndDelete(userIdToDelete);

        if (!deletedUser) {
            console.error(`[API DELETE /users/${userIdToDelete}] Usuário não encontrado durante exclusão final.`);
            return NextResponse.json({ error: 'Usuário não encontrado para exclusão' }, { status: 404 });
        }
        console.log(`[API DELETE /users/${userIdToDelete}] Usuário excluído com sucesso.`);
        return NextResponse.json({ message: 'Usuário excluído com sucesso', id: userIdToDelete });

    } catch (error) {
        console.error(`[API DELETE /users/${userIdToDelete}] Erro GERAL:`, error);
        const message = error instanceof Error ? error.message : 'Erro interno do servidor';
        return NextResponse.json({ error: 'Erro interno ao excluir usuário', details: message }, { status: 500 });
    }
}