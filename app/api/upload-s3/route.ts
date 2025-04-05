// FILE: app/api/upload-s3/route.ts (Refatorado)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3';

// Config desativando bodyParser continua necessária para FormData
export const config = { api: { bodyParser: false } };

export async function POST(request: Request) {
  try {
    // --- Verificação de Sessão e RBAC (Admin/Manager) ---
    // Permitindo Admin e Manager fazerem uploads genéricos.
    // Se fosse para avatar de usuário, a lógica seria diferente (verificar se é o próprio usuário).
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    if (!['admin', 'manager'].includes(session.user.role)) {
        console.warn(`[API POST /api/upload-s3] Acesso negado. User: ${session.user.id}, Role: ${session.user.role}`);
        return NextResponse.json({ error: 'Acesso restrito para upload genérico.' }, { status: 403 });
    }
    // --- Fim Verificação ---

    const formData = await request.formData();
    const file = formData.get('file') as File | null; // Adicionado null check

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 });
    }

    // Validação do arquivo (mantida)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; // Adicionado webp
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo inválido.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) { // Limite 10MB
      return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        console.error("[API POST /api/upload-s3] AWS_S3_BUCKET_NAME não configurado!");
        return NextResponse.json({ error: 'Erro de configuração do servidor (S3).' }, { status: 500 });
    }

    const uploadResult = await uploadFileToS3(
      { buffer, originalname: file.name, mimetype: file.type },
      bucketName
    );

    if (!uploadResult.success || !uploadResult.url) {
      console.error('Falha ao fazer upload para o S3:', uploadResult.error);
      return NextResponse.json({ error: uploadResult.error || 'Erro ao fazer upload do arquivo para o S3' }, { status: 500 });
    }

    return NextResponse.json({
        message: 'Imagem enviada com sucesso para o S3',
        fileName: uploadResult.fileName,
        url: uploadResult.url,
      }, { status: 201 } // Status 201 Created é mais apropriado para upload
    );
  } catch (error) {
    console.error('[API POST /api/upload-s3] Erro:', error);
    return NextResponse.json({ error: 'Erro interno ao processar o upload' }, { status: 500 });
  }
}