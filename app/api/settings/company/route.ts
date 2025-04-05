import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { AppSettings } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3';


// --- GET (Buscar configurações da empresa) ---
export async function GET(request: Request) {
    try {
        // Permitir que qualquer usuário autenticado veja as configs da empresa?
        // Ou apenas admin? Vamos restringir a admin por segurança.
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
             return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }

        await connectToDatabase();
        // Busca o documento único de configurações
        const settings = await AppSettings.findById('global_settings').lean();

        // Retorna as configurações ou um objeto vazio se não existirem
        return NextResponse.json(settings || {});

    } catch (error) {
        console.error('Erro ao buscar configurações da empresa:', error);
        return NextResponse.json({ error: 'Erro interno ao buscar configurações' }, { status: 500 });
    }
}

// --- PUT (Atualizar configurações da empresa) ---
export async function PUT(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Apenas administradores podem alterar as configurações' }, { status: 403 });
        }

        const formData = await request.formData();
        const updateData: any = { updatedAt: new Date() };

        // Extrair dados do formulário
        for (const [key, value] of formData.entries()) {
            if (key !== 'logo' && typeof value === 'string') {
                updateData[key] = value;
            }
        }

        const file = formData.get('logo') as File | null;
        let logoUrl: string | undefined;

        // Upload do logo se fornecido
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
            if (!allowedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) { // Limite 2MB
                return NextResponse.json({ error: 'Arquivo de logo inválido (tipo ou tamanho).' }, { status: 400 });
            }
            const buffer = Buffer.from(await file.arrayBuffer());
             const bucketName = process.env.AWS_S3_BUCKET_NAME;
             if (!bucketName) throw new Error("Bucket S3 não configurado.");

            const uploadResult = await uploadFileToS3({ buffer, originalname: `logo-${Date.now()}`, mimetype: file.type }, bucketName);

            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Falha no upload do logo.");
            }
            updateData.logoUrl = uploadResult.url;
            logoUrl = uploadResult.url;
        }

        await connectToDatabase();

        // Atualiza ou cria o documento de configurações
        const updatedSettings = await AppSettings.findByIdAndUpdate(
            'global_settings',
            { $set: updateData },
            { new: true, upsert: true, runValidators: true } // upsert: true cria se não existir
        ).lean();


        return NextResponse.json({ settings: updatedSettings, message: 'Configurações da empresa atualizadas com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar configurações da empresa:', error);
         const message = error instanceof Error ? error.message : 'Erro interno.';
        return NextResponse.json({ error: `Erro ao atualizar configurações: ${message}` }, { status: 500 });
    }
}