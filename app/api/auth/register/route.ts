import { NextResponse } from 'next/server';
import { hash } from 'bcrypt';
import { getServerSession } from 'next-auth/next';

import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';

export async function POST(request: Request) {
  try {
    // Verificar se o usuário atual é um administrador
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Não autorizado. Apenas administradores podem criar novos usuários.' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { name, email, password, role } = body;
    
    // Validar campos
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Validar papel do usuário
    if (role && !['admin', 'manager', 'user'].includes(role)) {
      return NextResponse.json(
        { error: 'Papel inválido. Deve ser admin, manager ou user.' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Verificar se o email já está em uso
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 409 }
      );
    }
    
    // Criptografar a senha
    const hashedPassword = await hash(password, 12);
    
    // Criar novo usuário
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
    });
    
    const createdUser = {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
    
    return NextResponse.json(
      { user: createdUser, message: 'Usuário criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}