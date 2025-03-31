import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3';

// Desativar o parser automático de corpo do Next.js para suportar formData
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: Request) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Obter os dados do formulário
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 });
    }

    // Validação do arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Apenas JPEG, PNG e GIF são permitidos.' },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) { // Limite de 10 MB
      return NextResponse.json(
        { error: 'Arquivo muito grande. Limite de 10 MB.' },
        { status: 400 }
      );
    }

    // Converter o arquivo para buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Fazer upload para o S3
    const uploadResult = await uploadFileToS3(
      { buffer, originalname: file.name, mimetype: file.type },
      process.env.AWS_S3_BUCKET_NAME || ''
    );

    if (!uploadResult.success || !uploadResult.url) {
      console.error('Falha ao fazer upload para o S3:', uploadResult.error);
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo para o S3' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Imagem enviada com sucesso para o S3',
        fileName: uploadResult.fileName,
        url: uploadResult.url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro ao processar o upload para o S3:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar o upload' },
      { status: 500 }
    );
  }
}