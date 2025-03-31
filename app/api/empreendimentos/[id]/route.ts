import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Despesa } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3';

// No `export const config` needed; App Router handles body parsing natively

export async function GET(req: NextRequest, { params }: { params:Promise< { id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    await connectToDatabase();
    const empreendimento = await Empreendimento.findById(id);
    if (!empreendimento) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    const [pendingExpensesCount, totalExpensesValue] = await Promise.all([
      Despesa.countDocuments({ empreendimento: id, status: { $in: ['Pendente', 'A vencer'] } }),
      Despesa.aggregate([
        { $match: { empreendimento: new mongoose.Types.ObjectId(id) } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ]),
    ]);

    const statistics = {
      pendingExpenses: pendingExpensesCount,
      totalExpenses: totalExpensesValue.length > 0 ? totalExpensesValue[0].total : 0,
    };

    return NextResponse.json({ empreendimento, statistics });
  } catch (error) {
    console.error('Erro ao buscar empreendimento:', error);
    return NextResponse.json({ error: 'Erro ao buscar empreendimento' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    await connectToDatabase();
    const existingEmpreendimento = await Empreendimento.findById(id);
    if (!existingEmpreendimento) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    const formData = await req.formData();
    const body: { [key: string]: string } = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        body[key] = value;
      }
    }

    const updateData: any = {
      ...body,
      updatedAt: new Date(),
    };

    const file = formData.get('image') as File | null; // Type assertion for clarity
    if (file) {
      console.log('Arquivo recebido no formData:', file);
      console.log('Propriedades do arquivo:', {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Tipo de arquivo inválido. Apenas JPEG, PNG e GIF são permitidos.' },
          { status: 400 }
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Arquivo muito grande. Limite de 10 MB.' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult = await uploadFileToS3(
        { buffer, originalname: file.name, mimetype: file.type },
        process.env.AWS_S3_BUCKET_NAME || ''
      );

      if (!uploadResult.success || !uploadResult.url) {
        console.error('Falha ao fazer upload para o S3:', uploadResult.error);
        return NextResponse.json(
          { error: 'Erro ao fazer upload da imagem de capa' },
          { status: 500 }
        );
      }

      updateData.image = uploadResult.url;
      console.log('Upload concluído. URL da imagem:', updateData.image);
    } else {
      console.log('Nenhum arquivo de imagem fornecido no formData para atualização.');
    }

    console.log('Atualizando empreendimento com os dados:', updateData);
    const updatedEmpreendimento = await Empreendimento.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    console.log('Empreendimento atualizado:', updatedEmpreendimento);

    return NextResponse.json({ empreendimento: updatedEmpreendimento, imageUrl: updateData.image });
  } catch (error) {
    console.error('Erro ao atualizar empreendimento:', error);
    return NextResponse.json({ error: 'Erro ao atualizar empreendimento' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Não autorizado. Apenas administradores podem excluir empreendimentos.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    await connectToDatabase();
    const despesasCount = await Despesa.countDocuments({ empreendimento: id });
    if (despesasCount > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir o empreendimento pois existem despesas relacionadas' },
        { status: 400 }
      );
    }

    const deletedEmpreendimento = await Empreendimento.findByIdAndDelete(id);
    if (!deletedEmpreendimento) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    return NextResponse.json({ message: 'Empreendimento excluído com sucesso', id });
  } catch (error) {
    console.error('Erro ao excluir empreendimento:', error);
    return NextResponse.json({ error: 'Erro ao excluir empreendimento' }, { status: 500 });
  }
}