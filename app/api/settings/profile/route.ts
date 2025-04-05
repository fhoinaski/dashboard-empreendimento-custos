import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3';
import mongoose from 'mongoose';

interface UserDocument {
    _id: mongoose.Types.ObjectId | string;
    name: string;
    email: string;
    avatarUrl?: string;
}

export async function PUT(request: Request) {
    console.log("--- [API Profile PUT] START ---");
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.warn("[API Profile PUT] Unauthorized (no session).");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        console.log(`[API Profile PUT] User authorized: ${session.user.id}`);

        let formData;
        try {
            formData = await request.formData();
            console.log("[API Profile PUT] FormData parsed successfully.");
        } catch (formError) {
            console.error("[API Profile PUT] Error parsing FormData:", formError);
            return NextResponse.json({ error: 'Erro ao processar dados do formulário.' }, { status: 400 });
        }

        const name = formData.get('name') as string | null;
        const file = formData.get('avatar') as File | null;

        console.log("[API Profile PUT] Fields extracted:", { name: name ?? '<not provided>', fileName: file?.name, fileSize: file?.size });

        const updateData: { [key: string]: any } = { updatedAt: new Date() };
        let requiresUpdate = false;

        if (name !== null && name !== undefined && name !== session.user.name) {
            updateData.name = name;
            requiresUpdate = true;
            console.log("[API Profile PUT] Name change detected.");
        }

        let s3UploadUrl: string | undefined;

        if (file) {
            console.log("[API Profile PUT] Processing avatar upload...");
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
                console.warn("[API Profile PUT] Invalid avatar file:", { type: file.type, size: file.size });
                return NextResponse.json({ error: 'Arquivo de avatar inválido (tipo ou tamanho).' }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const bucketName = process.env.AWS_S3_BUCKET_NAME;
            if (!bucketName) { throw new Error("Bucket S3 não configurado."); }
            const uniqueFileName = `avatars/${session.user.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
            const uploadResult = await uploadFileToS3({ buffer, originalname: uniqueFileName, mimetype: file.type }, bucketName);

            console.log("[API Profile PUT] S3 upload result:", uploadResult);
            if (!uploadResult.success || !uploadResult.url) {
                throw new Error(uploadResult.error || "Falha no upload do avatar.");
            }
            updateData.avatarUrl = uploadResult.url;
            s3UploadUrl = uploadResult.url;
            requiresUpdate = true;
            console.log("[API Profile PUT] S3 URL to save:", updateData.avatarUrl);
        }

        if (!requiresUpdate) {
            console.log("[API Profile PUT] No functional fields to update.");
            await connectToDatabase();
            const currentUser = await User.findById(session.user.id).select('name email avatarUrl');
            if (!currentUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
            return NextResponse.json({
                user: { _id: currentUser._id.toString(), name: currentUser.name, email: currentUser.email, avatarUrl: currentUser.avatarUrl },
                message: 'Nenhum dado alterado.'
            }, { status: 200 });
        }

        console.log("[API Profile PUT] Connecting to DB for update...");
        await connectToDatabase();

        // Log antes da atualização para debug
        const beforeUpdate = await User.findById(session.user.id);
        console.log("[API Profile PUT] User data BEFORE update:", beforeUpdate ? beforeUpdate.toObject() : null);

        console.log("[API Profile PUT] Data to update in DB:", updateData);

        // Usar findOneAndUpdate com opções para forçar salvamento
        const updatedUser = await User.findOneAndUpdate(
            { _id: session.user.id },
            { $set: updateData },
            { new: true, runValidators: true, upsert: false }
        );

        console.log("[API Profile PUT] User data AFTER update:", updatedUser ? updatedUser.toObject() : null);

        if (!updatedUser) {
            console.error("[API Profile PUT] CRITICAL: User not found AFTER update attempt:", session.user.id);
            return NextResponse.json({ error: 'Usuário não encontrado após tentativa de atualização' }, { status: 404 });
        }

        // Verificar se o avatarUrl foi corretamente salvo
        if (updateData.avatarUrl && !updatedUser.avatarUrl) {
            console.error("[API Profile PUT] ERROR: avatarUrl not saved in DB:", { 
                expected: updateData.avatarUrl, 
                got: updatedUser.avatarUrl 
            });
            
            // Atualização direta com método save para garantir que os dados sejam salvos
            if (beforeUpdate) {
                beforeUpdate.avatarUrl = updateData.avatarUrl;
                beforeUpdate.updatedAt = new Date();
                await beforeUpdate.save();
                
                // Verificar se a atualização foi bem-sucedida
                const verifiedUser = await User.findById(session.user.id);
                if (verifiedUser && verifiedUser.avatarUrl === updateData.avatarUrl) {
                    updatedUser.avatarUrl = verifiedUser.avatarUrl;
                    console.log("[API Profile PUT] avatarUrl successfully saved with direct method:", updatedUser.avatarUrl);
                } else {
                    console.error("[API Profile PUT] Failed to save avatarUrl even with direct method");
                    return NextResponse.json({ error: 'Falha ao salvar o avatar no banco de dados' }, { status: 500 });
                }
            } else {
                return NextResponse.json({ error: 'Usuário não encontrado para atualização direta' }, { status: 404 });
            }
        }

        const responseUser = {
            _id: updatedUser._id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            avatarUrl: updatedUser.avatarUrl
        };

        console.log("[API Profile PUT] FINAL response user:", JSON.stringify(responseUser));

        return NextResponse.json({
            user: responseUser,
            message: 'Perfil atualizado com sucesso'
        });

    } catch (error) {
        console.error('[API Profile PUT] CATCH BLOCK - General Error:', error);
        const message = error instanceof Error ? error.message : 'Erro interno do servidor.';
        return NextResponse.json({ error: `Erro ao atualizar perfil: ${message}` }, { status: 500 });
    } finally {
        console.log("--- [API Profile PUT] END ---");
    }
}