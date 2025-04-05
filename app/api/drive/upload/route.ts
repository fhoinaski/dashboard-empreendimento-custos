// FILE: app/api/drive/upload/route.ts (Refatorado)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types } from 'mongoose'; // Importar Types
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Documento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToDrive } from '@/lib/google/drive';

export async function POST(request: Request) {
  try {
    // --- Verificação de Sessão ---
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userRole = session.user.role;
    const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];
    // --- Fim Verificação ---

    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const folderId = formData.get('folderId') as string; // ID da pasta PAI do empreendimento no Drive
    const empreendimentoId = formData.get('empreendimentoId') as string | null; // Pode ser null se saveReference=false
    const category = formData.get('category') as string;
    const saveReference = formData.get('saveReference') === 'true';

    if (!files.length || !folderId || !category) {
      return NextResponse.json({ error: 'Arquivos, ID da pasta PAI e categoria são obrigatórios' }, { status: 400 });
    }

    // --- Validação de Permissão ---
    let canUpload = false;
    let targetEmpreendimentoId: Types.ObjectId | null = null;

    if (empreendimentoId && mongoose.isValidObjectId(empreendimentoId)) {
        targetEmpreendimentoId = new Types.ObjectId(empreendimentoId);
        // Se for salvar referência, precisa ter acesso ao empreendimento
        canUpload = userRole === 'admin' || userRole === 'manager' || (userRole === 'user' && userAssignedEmpreendimentos.includes(empreendimentoId));
    } else if (!saveReference) {
        // Se NÃO for salvar referência, apenas Admin/Manager podem fazer upload "genérico" para uma pasta?
        // Ou o frontend SEMPRE deve enviar empreendimentoId? Vamos permitir Admin/Manager por segurança.
        canUpload = userRole === 'admin' || userRole === 'manager';
    } else if (saveReference && (!empreendimentoId || !mongoose.isValidObjectId(empreendimentoId))) {
         // Se é para salvar referência, mas o ID do empreendimento é inválido/ausente
         return NextResponse.json({ error: 'ID de empreendimento inválido ou ausente para salvar referência' }, { status: 400 });
    }


    if (!canUpload) {
         console.warn(`[API POST /api/drive/upload] Usuário ${session.user.id} (${userRole}) sem permissão para upload neste contexto (Empreendimento: ${empreendimentoId})`);
         return NextResponse.json({ error: 'Acesso negado para este upload' }, { status: 403 });
    }
    // --- Fim Validação Permissão ---

    const uploadedFilesInfo: any[] = [];
    let empreendimentoDoc = null; // Para buscar apenas uma vez se for salvar referência

    if (saveReference && targetEmpreendimentoId) {
        await connectToDatabase();
        empreendimentoDoc = await Empreendimento.findById(targetEmpreendimentoId);
        if (!empreendimentoDoc) {
            return NextResponse.json({ error: 'Empreendimento não encontrado para salvar referência' }, { status: 404 });
        }
    }


    for (const file of files) {
      // Validação de arquivo (tipo/tamanho) pode ser adicionada aqui
      const buffer = Buffer.from(await file.arrayBuffer());
      // Passa o folderId PAI e a categoria para a função de upload encontrar/criar a subpasta
      const uploadResult = await uploadFileToDrive(
        { buffer, originalname: file.name, mimetype: file.type },
        folderId, // ID da pasta do Empreendimento
        category    // Categoria (subpasta)
      );

      if (!uploadResult.success) {
        console.warn(`Falha ao fazer upload do arquivo ${file.name}:`, uploadResult.error);
        continue;
      }

      uploadedFilesInfo.push({
        id: uploadResult.fileId,
        name: file.name,
        url: uploadResult.webViewLink, // Usar webViewLink para visualização
        type: file.type,
      });
    }

    if (uploadedFilesInfo.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo foi enviado com sucesso' }, { status: 500 });
    }

    // Salvar referências se necessário e permitido
    if (saveReference && empreendimentoDoc && targetEmpreendimentoId) {
      const documentsToCreate = uploadedFilesInfo.map(file => ({
        name: file.name,
        type: file.type || 'application/octet-stream',
        empreendimento: targetEmpreendimentoId,
        category: category || 'Outros',
        fileId: file.id,
        url: file.url,
        createdBy: new Types.ObjectId(session.user.id), // Corrigido para usar ObjectId
      }));

      try {
         await connectToDatabase(); // Garantir conexão
         const createdDocuments = await Documento.insertMany(documentsToCreate);
         console.log(`Documentos criados: ${createdDocuments.length}`);
         return NextResponse.json({
             message: 'Arquivos enviados e referências salvas com sucesso',
             files: uploadedFilesInfo,
             documents: createdDocuments.map(doc => doc.toObject()), // Retorna os documentos criados
         });
      } catch(dbError) {
           console.error("Erro ao salvar documentos no DB:", dbError);
           // Idealmente, deveria tentar excluir os arquivos do Drive aqui em caso de erro no DB
           return NextResponse.json({ error: 'Falha ao salvar referências dos documentos no banco de dados' }, { status: 500 });
      }
    }

    // Se não salvou referência, retorna apenas os arquivos upados
    return NextResponse.json({
      message: 'Arquivos enviados com sucesso para o Drive',
      files: uploadedFilesInfo,
    });

  } catch (error) {
    console.error('[API POST /api/drive/upload] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao fazer upload para o Google Drive' }, { status: 500 });
  }
}