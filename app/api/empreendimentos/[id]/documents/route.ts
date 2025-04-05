// FILE: app/api/empreendimentos/[id]/documents/route.ts (Refatorado com RBAC)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types } from 'mongoose'; // Importar Types
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Documento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToDrive, listFilesInFolder } from '@/lib/google/drive';

// --- Tipagem (sem alterações) ---
interface DriveFile { id: string; name: string; mimeType: string; webViewLink?: string; webContentLink?: string; createdTime?: string; size?: string; }
function convertDriveFiles(files: any[]): DriveFile[] {
    // Função original para converter dados do Drive
    return files
      .filter(file => file?.id && file.mimeType !== 'application/vnd.google-apps.folder') // Adicionado safe access
      .map(file => ({
        id: file.id || '',
        name: file.name || 'Sem nome',
        mimeType: file.mimeType || '',
        webViewLink: file.webViewLink ?? undefined,
        webContentLink: file.webContentLink ?? undefined,
        createdTime: file.createdTime ?? undefined,
        size: file.size ?? undefined
      }));
}
// --- Fim Tipagem ---

// GET - Listar documentos de um empreendimento (RBAC Adicionado)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log(`[API GET /empreendimentos/.../documents] Requisição recebida.`);
  try {
    const resolvedParams = await params;
    const empreendimentoId = resolvedParams.id;

    if (!mongoose.isValidObjectId(empreendimentoId)) {
      console.log(`[API GET /.../documents] ID inválido: ${empreendimentoId}`);
      return NextResponse.json({ error: 'ID de empreendimento inválido' }, { status: 400 });
    }

    // --- Verificação de Sessão e RBAC ---
    const session = await getServerSession(authOptions);
    // Verifica sessão, ID e role
    if (!session?.user?.id || !session.user.role) {
      console.warn(`[API GET /.../documents] Tentativa de acesso não autorizada (sem sessão válida) para Empr. ID: ${empreendimentoId}`);
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userRole = session.user.role;
    const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];
    // Verifica se o usuário pode acessar este empreendimento específico
    const canAccess = userRole === 'admin' || userRole === 'manager' || (userRole === 'user' && userAssignedEmpreendimentos.includes(empreendimentoId));

    if (!canAccess) {
        console.warn(`[API GET /.../documents] Usuário ${session.user.id} (${userRole}) sem permissão para Empr. ID: ${empreendimentoId}`);
        return NextResponse.json({ error: 'Acesso negado a este empreendimento' }, { status: 403 });
    }
    console.log(`[API GET /.../documents] Acesso autorizado para ${userRole} ${session.user.id} ao Empr. ID: ${empreendimentoId}.`);
    // --- Fim Verificação ---

    await connectToDatabase();
    const empreendimento = await Empreendimento.findById(empreendimentoId).select('folderId'); // Apenas o folderId é necessário
    if (!empreendimento) {
      console.log(`[API GET /.../documents] Empreendimento ${empreendimentoId} não encontrado no DB.`);
      return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
    }

    // Buscar documentos do DB (já sabemos que o usuário tem permissão)
    const documentos = await Documento.find({ empreendimento: empreendimentoId }).sort({ createdAt: -1 }).lean();
    console.log(`[API GET /.../documents] Encontrados ${documentos.length} documentos no DB.`);

    // Buscar arquivos do Drive (opcional)
    let driveFiles: DriveFile[] = [];
    if (empreendimento.folderId) {
        // const { searchParams } = new URL(request.url); // Descomente se precisar do parâmetro 'category'
        // const category = searchParams.get('category');
        console.log(`[API GET /.../documents] Tentando listar arquivos do Drive para folderId: ${empreendimento.folderId}`);
        try {
            const result = await listFilesInFolder(empreendimento.folderId);
            if (result.success && result.files) {
                driveFiles = convertDriveFiles(result.files);
                console.log(`[API GET /.../documents] Encontrados ${driveFiles.length} arquivos no Drive.`);
                // Adicionar lógica de filtro por categoria aqui, se necessário
            } else {
                console.warn(`[API GET /.../documents] Não foi possível listar arquivos do Drive: ${result.error}`);
            }
        } catch (driveError) {
             console.error(`[API GET /.../documents] Erro ao listar arquivos do Drive:`, driveError);
        }
    } else {
        console.log(`[API GET /.../documents] Empreendimento ${empreendimentoId} não possui folderId configurado.`);
    }

    return NextResponse.json({ documentos, driveFiles });

  } catch (error) {
    const empreendimentoIdError = params ? (await params).id : 'ID_DESCONHECIDO';
    console.error(`[API GET /empreendimentos/${empreendimentoIdError}/documents] Erro interno:`, error);
    return NextResponse.json({ error: 'Erro interno ao listar documentos' }, { status: 500 });
  }
}

// POST - Adicionar um documento ao empreendimento (RBAC Adicionado)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
   console.log(`[API POST /empreendimentos/.../documents] Requisição recebida.`);
  try {
    const resolvedParams = await params;
    const empreendimentoId = resolvedParams.id;

    if (!mongoose.isValidObjectId(empreendimentoId)) {
      console.log(`[API POST /.../documents] ID inválido: ${empreendimentoId}`);
      return NextResponse.json({ error: 'ID de empreendimento inválido' }, { status: 400 });
    }

    // --- Verificação de Sessão e RBAC ---
    const session = await getServerSession(authOptions);
    // Verifica sessão, ID, role e email
    if (!session?.user?.id || !session.user.role || !session.user.email) {
        console.warn(`[API POST /.../documents] Tentativa de acesso não autorizada (sem sessão válida) para Empr. ID: ${empreendimentoId}`);
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userRole = session.user.role;
    const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];
    // Verifica se pode adicionar documento a ESTE empreendimento
    const canAccess = userRole === 'admin' || userRole === 'manager' || (userRole === 'user' && userAssignedEmpreendimentos.includes(empreendimentoId));

    if (!canAccess) {
        console.warn(`[API POST /.../documents] Usuário ${session.user.id} (${userRole}) sem permissão para Empr. ID: ${empreendimentoId}`);
        return NextResponse.json({ error: 'Acesso negado para adicionar documento neste empreendimento' }, { status: 403 });
    }
    console.log(`[API POST /.../documents] Acesso autorizado para ${userRole} ${session.user.id} ao Empr. ID: ${empreendimentoId}.`);
    // --- Fim Verificação ---

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null; // Nome pode ser opcional (usar nome do arquivo)
    // const type = formData.get('type') as string | null; // Tipo pode ser inferido do arquivo
    const category = formData.get('category') as string | null;

    if (!file) {
      console.log("[API POST /.../documents] Arquivo não fornecido.");
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }

    // Validações de arquivo (tamanho, tipo) podem ser adicionadas aqui

    const finalName = name || file.name;
    const finalCategory = category || 'Outros'; // Categoria padrão

    await connectToDatabase();
    const empreendimento = await Empreendimento.findById(empreendimentoId).select('folderId name'); // Buscar nome também
    if (!empreendimento) {
      console.log(`[API POST /.../documents] Empreendimento ${empreendimentoId} não encontrado no DB.`);
      return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
    }
    if (!empreendimento.folderId) {
      console.warn(`[API POST /.../documents] Empreendimento ${empreendimentoId} não possui folderId configurado.`);
      return NextResponse.json({ error: 'Configuração do Google Drive pendente para este empreendimento' }, { status: 400 });
    }

    console.log(`[API POST /.../documents] Fazendo upload para folderId: ${empreendimento.folderId}, Categoria: ${finalCategory}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadFileToDrive(
      { buffer, originalname: file.name, mimetype: file.type },
      empreendimento.folderId,
      finalCategory
    );

    if (!uploadResult.success || !uploadResult.fileId || !uploadResult.webViewLink) {
      console.error(`[API POST /.../documents] Erro no upload para o Drive: ${uploadResult.error}`);
      return NextResponse.json({ error: uploadResult.error || 'Erro ao fazer upload para o Google Drive' }, { status: 500 });
    }
    console.log(`[API POST /.../documents] Upload para o Drive bem-sucedido. File ID: ${uploadResult.fileId}`);

    // Salvar referência do documento no MongoDB
    const documento = await Documento.create({
      name: finalName,
      type: file.type, // Usar o mimetype real do arquivo
      empreendimento: empreendimentoId,
      category: finalCategory,
      fileId: uploadResult.fileId,
      url: uploadResult.webViewLink, // Usar o link de visualização
      createdBy: new Types.ObjectId(session.user.id), // **IMPORTANTE: Usar ObjectId do usuário**
    });
    console.log(`[API POST /.../documents] Documento salvo no DB com ID: ${documento._id}`);

    // Retornar o documento criado e informações do arquivo
    return NextResponse.json({
      documento: documento.toObject(), // Converte Mongoose doc para objeto JS
      file: {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        url: uploadResult.webViewLink,
      }
    }, { status: 201 }); // Status 201 Created

  } catch (error) {
    const empreendimentoIdError = params ? (await params).id : 'ID_DESCONHECIDO';
    console.error(`[API POST /empreendimentos/${empreendimentoIdError}/documents] Erro interno:`, error);
    return NextResponse.json({ error: 'Erro interno ao adicionar documento' }, { status: 500 });
  }
}