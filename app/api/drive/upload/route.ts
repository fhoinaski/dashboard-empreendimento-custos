import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';

import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Documento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToDrive } from '@/lib/google/drive';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    const folderId = formData.get('folderId') as string;
    const empreendimentoId = formData.get('empreendimentoId') as string;
    const category = formData.get('category') as string;
    const saveReference = formData.get('saveReference') === 'true';

    if (!files.length || !folderId || !category) {
      return NextResponse.json({ error: 'Arquivos, ID da pasta e categoria são obrigatórios' }, { status: 400 });
    }
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadedFiles: any[] = [];

    // Processar cada arquivo
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult = await uploadFileToDrive(
        { buffer, originalname: file.name, mimetype: file.type },
        folderId,
        category
      );

      if (!uploadResult.success) {
        console.warn(`Falha ao fazer upload do arquivo ${file.name}:`, uploadResult.error);
        continue; // Continua com o próximo arquivo em caso de erro
      }

      uploadedFiles.push({
        id: uploadResult.fileId,
        name: file.name,
        url: uploadResult.url,
        type: file.type // Usando apenas o type do File
      });
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo foi enviado com sucesso' }, { status: 500 });
    }

    // Salvar a referência no modelo Documento, se necessário
    if (saveReference && empreendimentoId) {
      if (!mongoose.isValidObjectId(empreendimentoId)) {
        console.error(`ID de empreendimento inválido: ${empreendimentoId}`);
        return NextResponse.json({ error: 'ID de empreendimento inválido' }, { status: 400 });
      }

      await connectToDatabase();
      const empreendimento = await Empreendimento.findById(empreendimentoId);
      if (!empreendimento) {
        console.error(`Empreendimento não encontrado: ${empreendimentoId}`);
        return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
      }

      // Criar um documento para cada arquivo
      const documents = await Promise.all(
        uploadedFiles.map(async (file) => {
          try {
            const doc = await Documento.create({
              name: file.name,
              type: file.type || 'application/octet-stream', // Fallback para tipo genérico
              empreendimento: empreendimentoId,
              category: category || 'Outros',
              fileId: file.id,
              url: file.url,
              createdBy: session.user.id,
            });
            console.log(`Documento criado para o arquivo ${file.name}:`, doc);
            return doc;
          } catch (error) {
            console.error(`Erro ao criar documento para o arquivo ${file.name}:`, error);
            return null;
          }
        })
      );

      // Filtrar documentos que foram criados com sucesso
      const successfulDocuments = documents.filter((doc) => doc !== null);

      if (successfulDocuments.length === 0) {
        console.error('Nenhum documento foi salvo no banco de dados');
        return NextResponse.json({ error: 'Falha ao salvar os documentos no banco de dados' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Arquivos enviados e referências salvas com sucesso',
        files: uploadedFiles,
        documents: successfulDocuments,
      });
    }

    return NextResponse.json({
      message: 'Arquivos enviados com sucesso',
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Erro ao fazer upload para o Google Drive:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload para o Google Drive' }, { status: 500 });
  }
}