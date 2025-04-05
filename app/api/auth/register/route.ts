import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import mongoose, { Types } from 'mongoose';

export async function POST(request: Request) {
  console.log("[API POST /api/auth/register] Received request.");
  try {
    // Verificar status de admin
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      console.warn("[API POST /register] Forbidden: Not an admin.");
      return NextResponse.json(
        { error: 'Não autorizado. Apenas administradores podem criar usuários.' },
        { status: 403 }
      );
    }

    // Conectar ao banco de dados primeiro
    await connectToDatabase();

    const body = await request.json();
    console.log("[API POST /register] Request body:", JSON.stringify(body, null, 2));
    const { name, email, password, role, assignedEmpreendimentos } = body;

    // Validar campos obrigatórios
    if (!name || !email || !password) {
      console.error("[API POST /register] Missing required fields.");
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o email já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(`[API POST /register] Email already in use: ${email}`);
      return NextResponse.json({ error: 'Email já está em uso' }, { status: 409 });
    }

    // Criptografar senha
    console.log("[API POST /register] Hashing password...");
    const hashedPassword = await hash(password, 12);

    // Validar role
    const validRoles = ['admin', 'manager', 'user'];
    const finalRole = validRoles.includes(role) ? role : 'user';

    // Preparar document base
    const userData = {
      name,
      email,
      password: hashedPassword,
      role: finalRole,
    };

    // Adicionar empreendimentos para usuários
    if (finalRole === 'user' && Array.isArray(assignedEmpreendimentos) && assignedEmpreendimentos.length > 0) {
      console.log(`[API POST /register] Processing assignedEmpreendimentos:`, assignedEmpreendimentos);
      
      // Validar IDs
      const validIds = assignedEmpreendimentos.every(id => mongoose.isValidObjectId(id));
      if (!validIds) {
        return NextResponse.json(
          { error: `Um ou mais IDs de empreendimento são inválidos` },
          { status: 400 }
        );
      }

      // Verificar se empreendimentos existem
      const objectIds = assignedEmpreendimentos.map(id => new mongoose.Types.ObjectId(id));
      const emps = await Empreendimento.find({ _id: { $in: objectIds } }).lean();
      
      if (emps.length !== objectIds.length) {
        return NextResponse.json(
          { error: 'Um ou mais empreendimentos atribuídos não existem.' },
          { status: 400 }
        );
      }

      // Correção importante: Verificar se o campo existe no modelo
      console.log("[API POST /register] Adding empreendimentos directly to userData");
      // @ts-ignore - Forçando a atribuição para garantir que seja salvo
      userData.assignedEmpreendimentos = objectIds;
    }

    // Insere diretamente no banco de dados para contornar possíveis problemas de validação
    console.log("[API POST /register] Final userData:", JSON.stringify(userData, null, 2));
    
    // Cria o usuário diretamente usando o modelo do mongoose
    const result = await mongoose.connection.collection('users').insertOne({
      ...userData,
      notificationPreferences: {
        emailDespesasVencer: true,
        emailDocumentosNovos: true,
        emailRelatoriosSemanais: false,
        systemDespesasVencer: true,
        systemDocumentosNovos: true,
        systemEventosCalendario: true,
        antecedenciaVencimento: 3,
      },
      preferences: {
        language: 'pt-BR',
        dateFormat: 'dd/MM/yyyy',
        currency: 'BRL',
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`[API POST /register] User inserted with ID: ${result.insertedId}`);

    // Busca o usuário recém-criado para confirmar dados
    const createdUserDoc = await User.findById(result.insertedId);
    console.log(`[API POST /register] Created user:`, JSON.stringify({
      id: createdUserDoc?._id,
      assignedEmpreendimentos: createdUserDoc?.assignedEmpreendimentos
    }, null, 2));

    // Resposta
    const userResponse = {
      id: result.insertedId.toString(),
      name,
      email,
      role: finalRole,
      assignedEmpreendimentos: Array.isArray(assignedEmpreendimentos) ? assignedEmpreendimentos : []
    };

    return NextResponse.json(
      { user: userResponse, message: 'Usuário criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API POST /api/auth/register] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro ao criar usuário: ${message}` }, { status: 500 });
  }
}