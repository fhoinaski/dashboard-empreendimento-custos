// ============================================================
// START OF REFACTORED FILE: app/api/auth/register/route.ts (Fix TS18049)
// ============================================================
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento } from '@/lib/db/models'; // Modelos já incluem tenantId opcional
import { authOptions } from '@/lib/auth/options'; // authOptions já tipadas
import mongoose, { Types } from 'mongoose';

export async function POST(request: Request) {
  console.log("[API POST /api/auth/register] Received request.");
  try {
    const session = await getServerSession(authOptions);
    // Verifica se é admin E se TEM tenantId (Super Admin não pode usar esta rota)
    if (session?.user?.role !== 'admin' || !session?.user?.tenantId || !mongoose.isValidObjectId(session.user.tenantId)) {
      console.warn("[API POST /register] Forbidden: Not an admin or missing/invalid tenantId.");
      return NextResponse.json(
        { error: 'Apenas administradores de um tenant podem registrar usuários.' },
        { status: 403 }
      );
    }
    const adminTenantId = new Types.ObjectId(session.user.tenantId);
    console.log(`[API POST /register] Admin ${session.user.id} autorizado. Tenant: ${adminTenantId}`);

    await connectToDatabase();

    const body = await request.json();
    console.log("[API POST /register] Request body:", JSON.stringify(body, null, 2));
    const { name, email, password, role, assignedEmpreendimentos } = body;

    if (!name || !email || !password) { return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 }); }

    // Verificar se o email já existe NO MESMO TENANT
    const existingUser = await User.findOne({ email, tenantId: adminTenantId });
    if (existingUser) {
      console.warn(`[API POST /register] Email ${email} already in use within tenant ${adminTenantId}`);
      return NextResponse.json({ error: `Email já está em uso neste tenant.` }, { status: 409 });
    }

    const hashedPassword = await hash(password, 12);
    // Não permite criar superadmin ou admin via esta rota, força manager ou user
    const validRoles = ['manager', 'user'];
    const finalRole = validRoles.includes(role) ? role : 'user';

    // Preparar userData incluindo o tenantId do admin
    const userData: any = {
      tenantId: adminTenantId, // <-- TenantId obrigatório para usuários criados aqui
      name,
      email,
      password: hashedPassword,
      role: finalRole,
      notificationPreferences: { emailDespesasVencer: true, emailDocumentosNovos: true, emailRelatoriosSemanais: false, systemDespesasVencer: true, systemDocumentosNovos: true, systemEventosCalendario: true, antecedenciaVencimento: 3, },
      preferences: { language: 'pt-BR', dateFormat: 'dd/MM/yyyy', currency: 'BRL', },
      assignedEmpreendimentos: [], // Inicializa vazio
    };

    // Validar e atribuir empreendimentos DENTRO DO MESMO TENANT (só para role 'user')
    if (finalRole === 'user' && Array.isArray(assignedEmpreendimentos) && assignedEmpreendimentos.length > 0) {
      console.log(`[API POST /register] Processing assignedEmpreendimentos for tenant ${adminTenantId}:`, assignedEmpreendimentos);
      const validIds = assignedEmpreendimentos.every(id => mongoose.isValidObjectId(id));
      if (!validIds) { return NextResponse.json({ error: `Um ou mais IDs de empreendimento são inválidos` }, { status: 400 }); }

      const objectIds = assignedEmpreendimentos.map(id => new Types.ObjectId(id));
      const emps = await Empreendimento.find({ _id: { $in: objectIds }, tenantId: adminTenantId }).lean();
      if (emps.length !== objectIds.length) {
        console.error(`[API POST /register] Um ou mais empreendimentos não existem ou não pertencem ao tenant ${adminTenantId}.`);
        return NextResponse.json({ error: 'Um ou mais empreendimentos atribuídos não existem ou não pertencem a este tenant.' }, { status: 400 });
      }
      userData.assignedEmpreendimentos = objectIds;
    }
    // Managers veem todos do tenant, não precisam de designação específica aqui.

    // Usar Mongoose para criar o usuário
    console.log("[API POST /register] Final userData for Mongoose create:", JSON.stringify(userData, null, 2));
    const createdUserDoc = await User.create(userData);
    console.log(`[API POST /register] User created via Mongoose with ID: ${createdUserDoc._id} in tenant ${createdUserDoc.tenantId}`);

    // Resposta
    const userResponse = {
      id: createdUserDoc._id.toString(),
      // CORRIGIDO: Usar o tenantId do objeto userData que foi usado para criar
      tenantId: userData.tenantId.toString(),
      name,
      email,
      role: finalRole,
      assignedEmpreendimentos: Array.isArray(userData.assignedEmpreendimentos) ? userData.assignedEmpreendimentos.map((id: Types.ObjectId) => id.toString()) : []
    };

    return NextResponse.json(
      { user: userResponse, message: 'Usuário criado com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API POST /api/auth/register] Error:', error);
     if (error instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return NextResponse.json({ error: `Erro de validação: ${validationErrors.join(', ')}` }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: `Erro ao criar usuário: ${message}` }, { status: 500 });
  }
}
// ============================================================
// END OF REFACTORED FILE: app/api/auth/register/route.ts
// ============================================================