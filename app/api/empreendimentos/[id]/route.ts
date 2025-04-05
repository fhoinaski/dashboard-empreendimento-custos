/* ================================== */
/*  app/api/empreendimentos/[id]/route.ts */
/* ================================== */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, Despesa } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { uploadFileToS3 } from '@/lib/s3'; // Assuming S3 for image upload

// --- GET: Fetch Empreendimento Details ---
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        // --- RBAC CHECK: Allow Admin and Manager ---
        if (!session || !['admin', 'manager'].includes(session.user.role ?? '')) {
            console.warn(`[API GET /empreendimentos/${(await params).id}] Access denied. Role: ${session?.user?.role}`);
            return NextResponse.json({ error: 'Acesso restrito a administradores e gerentes' }, { status: 403 });
        }
        // --- END RBAC CHECK ---

        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        await connectToDatabase();
        const empreendimento = await Empreendimento.findById(id).lean(); // Use lean
        if (!empreendimento) {
            return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
        }

        // Calculate statistics (Only admins see full stats, managers might see limited stats if needed)
        let statistics = { pendingExpenses: 0, totalExpenses: 0 };
        if (session.user.role === 'admin') {
            const [pendingExpensesCount, totalExpensesValue] = await Promise.all([
                Despesa.countDocuments({ empreendimento: id, status: { $in: ['Pendente', 'A vencer'] } }),
                Despesa.aggregate([
                    { $match: { empreendimento: new mongoose.Types.ObjectId(id), status: { $in: ['Pago', 'A vencer'] } } },
                    { $group: { _id: null, total: { $sum: '$value' } } },
                ]),
            ]);
            statistics = {
                pendingExpenses: pendingExpensesCount,
                totalExpenses: totalExpensesValue.length > 0 ? totalExpensesValue[0].total : 0,
            };
        }
        // Managers don't get these stats by default

        // Convert dates to ISO strings for JSON compatibility
        const responseEmpreendimento = {
            ...empreendimento,
            _id: empreendimento._id.toString(),
            startDate: empreendimento.startDate?.toISOString(),
            endDate: empreendimento.endDate?.toISOString(),
            createdAt: empreendimento.createdAt?.toISOString(),
            updatedAt: empreendimento.updatedAt?.toISOString(),
            createdBy: empreendimento.createdBy?.toString(),
        };


        return NextResponse.json({ empreendimento: responseEmpreendimento, statistics });
    } catch (error) {
        console.error(`Erro em GET /api/empreendimentos/${(await params).id}:`, error);
        return NextResponse.json({ error: 'Erro ao buscar empreendimento' }, { status: 500 });
    }
}

// --- PUT: Update Empreendimento ---
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        // --- RBAC CHECK: ADMIN ONLY ---
        if (!session || session.user.role !== 'admin') {
            console.warn(`[API PUT /empreendimentos/${(await params).id}] Access denied. Role: ${session?.user?.role}`);
            return NextResponse.json({ error: 'Apenas administradores podem editar empreendimentos.' }, { status: 403 });
        }
        // --- END RBAC CHECK ---

        const resolvedParams = await params;
        const { id } = resolvedParams;
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        await connectToDatabase();
        const existingEmpreendimento = await Empreendimento.findById(id);
        if (!existingEmpreendimento) {
            return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
        }

        const formData = await req.formData();
        const updateData: { [key: string]: any } = { updatedAt: new Date() };

        // Extract and parse form data
        for (const [key, value] of formData.entries()) {
            if (key === 'image') continue; // Handle image separately
            if (typeof value === 'string') {
                if (['totalUnits', 'soldUnits'].includes(key)) {
                    const num = parseInt(value, 10);
                    if (!isNaN(num)) updateData[key] = num;
                } else if (['startDate', 'endDate'].includes(key)) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) updateData[key] = date;
                } else {
                    updateData[key] = value;
                }
            }
        }

        // Validate units (only if present in updateData)
        const totalUnits = updateData.totalUnits ?? existingEmpreendimento.totalUnits;
        const soldUnits = updateData.soldUnits ?? existingEmpreendimento.soldUnits;
        if (updateData.hasOwnProperty('totalUnits') || updateData.hasOwnProperty('soldUnits')) {
            if (typeof totalUnits !== 'number' || typeof soldUnits !== 'number' || soldUnits < 0 || totalUnits < 1 || soldUnits > totalUnits) {
                return NextResponse.json({ error: 'Valores de unidades inválidos.' }, { status: 400 });
            }
        }

        // Validate dates (only if present in updateData)
        const startDate = updateData.startDate ?? existingEmpreendimento.startDate;
        const endDate = updateData.endDate ?? existingEmpreendimento.endDate;
        if (updateData.hasOwnProperty('startDate') || updateData.hasOwnProperty('endDate')) {
            if (!(startDate instanceof Date) || !(endDate instanceof Date) || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
                return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
            }
        }

        // Handle image upload
        const file = formData.get('image') as File | null;
        if (file) {
            console.log('[API PUT /empreendimentos] Uploading new image...');
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Tipo de arquivo inválido.' }, { status: 400 });
            if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 400 });

            const buffer = Buffer.from(await file.arrayBuffer());
            const bucketName = process.env.AWS_S3_BUCKET_NAME;
            if (!bucketName) {
                console.error("AWS_S3_BUCKET_NAME não configurado!");
                return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
            }
            const uploadResult = await uploadFileToS3({ buffer, originalname: file.name, mimetype: file.type }, bucketName);
            if (!uploadResult.success || !uploadResult.url) { console.error('Falha ao fazer upload S3:', uploadResult.error); return NextResponse.json({ error: 'Erro upload imagem' }, { status: 500 }); }
            updateData.image = uploadResult.url;
            console.log('[API PUT /empreendimentos] Upload S3 OK. URL:', updateData.image);
        }

        // Perform Update
        console.log('[API PUT /empreendimentos] Atualizando com:', updateData);
        const updatedEmpreendimentoDoc = await Empreendimento.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).lean();

        if (!updatedEmpreendimentoDoc) {
            return NextResponse.json({ error: "Falha ao atualizar empreendimento no banco." }, { status: 500 });
        }

        console.log('[API PUT /empreendimentos] Empreendimento atualizado:', updatedEmpreendimentoDoc._id);
        // Convert dates before sending response
        const responseUpdatedEmpreendimento = {
            ...updatedEmpreendimentoDoc,
            _id: updatedEmpreendimentoDoc._id.toString(),
            startDate: updatedEmpreendimentoDoc.startDate?.toISOString(),
            endDate: updatedEmpreendimentoDoc.endDate?.toISOString(),
            createdAt: updatedEmpreendimentoDoc.createdAt?.toISOString(),
            updatedAt: updatedEmpreendimentoDoc.updatedAt?.toISOString(),
            createdBy: updatedEmpreendimentoDoc.createdBy?.toString(),
        };

        return NextResponse.json({ empreendimento: responseUpdatedEmpreendimento });

    } catch (error) {
        console.error(`Erro em PUT /api/empreendimentos/${(await params).id}:`, error);
        const msg = error instanceof mongoose.Error.ValidationError ? 'Dados inválidos.' : 'Erro ao atualizar empreendimento';
        return NextResponse.json({ error: msg, details: error instanceof Error ? error.message : undefined }, { status: error instanceof mongoose.Error.ValidationError ? 400 : 500 });
    }
}

// --- DELETE: Delete Empreendimento ---
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        const resolvedParams = await params;
        const { id } = resolvedParams;
        // --- RBAC CHECK: ADMIN ONLY ---
        
        if (!session || session.user.role !== 'admin') {
            console.warn(`[API DELETE /empreendimentos/${resolvedParams.id}] Access denied. Role: ${session?.user?.role}`);
            return NextResponse.json({ error: 'Apenas administradores podem excluir empreendimentos.' }, { status: 403 });
        }
        // --- END RBAC CHECK ---

        
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        await connectToDatabase();
        // Check for related expenses before deleting (optional but recommended)
        const despesasCount = await Despesa.countDocuments({ empreendimento: id });
        if (despesasCount > 0) {
            console.warn(`Tentativa de excluir empreendimento ${id} com ${despesasCount} despesas relacionadas.`);
            return NextResponse.json({ error: `Não é possível excluir. Existem ${despesasCount} despesa(s) associada(s).` }, { status: 400 });
        }
        // TODO: Add check for Documentos model if it exists and is relevant

        const deletedEmpreendimento = await Empreendimento.findByIdAndDelete(id);
        if (!deletedEmpreendimento) {
            return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });
        }

        // TODO: Consider deleting associated Google Drive folder and Sheet? Requires careful implementation.

        return NextResponse.json({ message: 'Empreendimento excluído com sucesso', id });
    } catch (error) {
        console.error(`Erro em DELETE /api/empreendimentos/${(await params).id}:`, error);
        return NextResponse.json({ error: 'Erro ao excluir empreendimento' }, { status: 500 });
    }
}