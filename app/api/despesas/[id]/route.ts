import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types, FilterQuery } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento, User, DespesaDocument } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { updateDespesaInSheet, deleteDespesaFromSheet } from '@/lib/google/sheets';
import { uploadFileToDrive } from '@/lib/google/drive'; // Assuming Drive

// --- Tipagem para o objeto Lean populado ---
// (Necessário para ajudar o TypeScript com .lean() e .populate())
interface PopulatedLeanDespesa extends Omit<DespesaDocument, 'empreendimento' | 'createdBy' | 'reviewedBy'> {
    _id: Types.ObjectId; // Garante que _id é ObjectId antes do lean
    empreendimento?: { _id: Types.ObjectId; name: string; sheetId?: string; folderId?: string };
    createdBy?: { _id: Types.ObjectId; name: string };
    reviewedBy?: { _id: Types.ObjectId; name: string };
}

// Interface para a resposta do cliente (mantida)
interface ClientDespesa {
    _id: string; description: string; value: number; date: string; dueDate: string;
    status: string; approvalStatus: string; category: string; notes?: string | null; paymentMethod?: string;
    empreendimento: { _id: string; name: string; };
    createdBy?: { _id: string; name: string; };
    reviewedBy?: { _id: string; name: string; };
    reviewedAt?: string | null; // Permitir null
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: string }>;
    createdAt: string; updatedAt: string;
}

// --- GET Handler ---
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role;

        const resolvedParams = await params;
        const { id } = resolvedParams;

        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        await connectToDatabase();

        const despesaDoc = await Despesa.findById(id)
            .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>("empreendimento", "name _id")
            .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>("createdBy", "name _id")
            .populate<{ reviewedBy: { _id: Types.ObjectId; name: string } }>("reviewedBy", "name _id")
            .lean<PopulatedLeanDespesa | null>(); // Use a tipagem PopulatedLeanDespesa

        if (!despesaDoc) {
            return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
        }

        // --- RBAC Check for Viewing ---
        const canView =
            userRole === 'admin' ||
            userRole === 'manager' ||
            (userRole === 'user' && despesaDoc.createdBy?._id.equals(userId)); // User can see their own

        if (!canView) {
            return NextResponse.json({ error: 'Acesso negado a esta despesa' }, { status: 403 });
        }
        // --- End RBAC Check ---

        const responseDespesa: ClientDespesa = {
            _id: despesaDoc._id.toString(),
            description: despesaDoc.description,
            value: despesaDoc.value,
            date: despesaDoc.date instanceof Date ? despesaDoc.date.toISOString() : new Date().toISOString(),
            dueDate: despesaDoc.dueDate instanceof Date ? despesaDoc.dueDate.toISOString() : new Date().toISOString(),
            status: despesaDoc.status,
            approvalStatus: despesaDoc.approvalStatus,
            category: despesaDoc.category,
            notes: despesaDoc.notes ?? null,
            paymentMethod: despesaDoc.paymentMethod,
            empreendimento: {
                _id: despesaDoc.empreendimento?._id.toString() ?? '',
                name: despesaDoc.empreendimento?.name ?? 'N/A',
            },
            createdBy: despesaDoc.createdBy ? {
                _id: despesaDoc.createdBy._id.toString(),
                name: despesaDoc.createdBy.name,
            } : undefined,
            reviewedBy: despesaDoc.reviewedBy ? {
                _id: despesaDoc.reviewedBy._id.toString(),
                name: despesaDoc.reviewedBy.name,
            } : undefined,
            reviewedAt: despesaDoc.reviewedAt instanceof Date ? despesaDoc.reviewedAt.toISOString() : null,
            attachments: despesaDoc.attachments?.map((att) => ({
                fileId: att.fileId,
                name: att.name,
                url: att.url,
                _id: att._id?.toString(),
            })) ?? [],
            createdAt: despesaDoc.createdAt instanceof Date ? despesaDoc.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: despesaDoc.updatedAt instanceof Date ? despesaDoc.updatedAt.toISOString() : new Date().toISOString(),
        };


        return NextResponse.json({ despesa: responseDespesa });
    } catch (error) {
        console.error(`Erro em GET /api/despesas/${params ? (await params).id : 'invalid'}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// --- PUT Handler ---
export async function PUT(request: NextRequest, { params }: { params: Promise< { id: string }> }) {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: 'ID de despesa inválido' }, { status: 400 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role;

        await connectToDatabase();
        const despesaToUpdate = await Despesa.findById(id);

        if (!despesaToUpdate) {
            return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
        }

        // --- RBAC Check for Editing ---
        const isCreator = despesaToUpdate.createdBy.equals(userId);
        const isPending = despesaToUpdate.approvalStatus === 'Pendente';
        const canEdit =
            userRole === 'admin' || // Admin can edit anytime (perhaps with restrictions later?)
            (isCreator && isPending); // Creator can edit only if pending approval

        if (!canEdit) {
            return NextResponse.json({ error: 'Você não tem permissão para editar esta despesa neste estado.' }, { status: 403 });
        }
        // --- End RBAC Check ---

        const formData = await request.formData();
        const updateData: { [key: string]: any } = { updatedAt: new Date() };
        let newFile: File | null = null;

        // Process form fields
        for (const [key, value] of formData.entries()) {
            if (key === 'file') {
                if (value instanceof File && value.size > 0) {
                    newFile = value;
                    // Validate file (type/size) - simplistic example
                     const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
                     const maxSize = 10 * 1024 * 1024; // 10MB
                     if (!allowedTypes.includes(value.type)) return NextResponse.json({ error: `Tipo de arquivo inválido.` }, { status: 400 });
                     if (value.size > maxSize) return NextResponse.json({ error: `Arquivo muito grande.` }, { status: 400 });
                }
            } else if (typeof value === 'string') {
                if (key === 'value') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    if (!isNaN(numValue)) updateData[key] = numValue;
                } else if (key === 'date' || key === 'dueDate') {
                    const dateValue = new Date(value);
                    if (!isNaN(dateValue.getTime())) updateData[key] = dateValue;
                } else if (key === 'status' && !['Pago', 'Pendente', 'A vencer'].includes(value)) {
                    // Allow only specific status updates if not admin? For now, let API handle
                    // Ignore invalid status potentially sent by non-admins modifying payload
                    if (userRole === 'admin' || isCreator) { // Let admin/creator change status
                        updateData[key] = value;
                    }
                }
                 else {
                    updateData[key] = value;
                }
            }
        }


        // Handle File Upload only if a new file was provided
        if (newFile) {
            const empreendimento = await Empreendimento.findById(despesaToUpdate.empreendimento).select('folderId');
            if (!empreendimento?.folderId) {
                return NextResponse.json({ error: 'Pasta do empreendimento no Drive não encontrada para upload.' }, { status: 400 });
            }

            try {
                const buffer = Buffer.from(await newFile.arrayBuffer());
                const uploadResult = await uploadFileToDrive(
                    { buffer, originalname: newFile.name, mimetype: newFile.type },
                    empreendimento.folderId,
                    'Despesas' // Or use existing category if needed
                );
                if (uploadResult.success && uploadResult.fileId && uploadResult.fileName && uploadResult.webViewLink) {
                    // Replace existing attachments or add if none existed
                    updateData.attachments = [{ fileId: uploadResult.fileId, name: uploadResult.fileName, url: uploadResult.webViewLink }];
                } else {
                    console.warn('Falha no upload do novo anexo:', uploadResult.error);
                    // Decide se continua ou retorna erro
                }
            } catch (uploadError) {
                console.error("Erro durante o upload do novo anexo:", uploadError);
                return NextResponse.json({ error: 'Erro ao fazer upload do novo anexo' }, { status: 500 });
            }
        }


        // Perform the update
        const updatedDespesaDoc = await Despesa.findByIdAndUpdate(
            id,
            { $set: updateData }, // Use $set to only update provided fields
            { new: true, runValidators: true }
        )
        .populate<{ empreendimento: { _id: Types.ObjectId; name: string; sheetId?: string } }>("empreendimento", "name _id sheetId")
        .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>("createdBy", "name _id")
        .populate<{ reviewedBy: { _id: Types.ObjectId; name: string } }>("reviewedBy", "name _id")
        .lean<PopulatedLeanDespesa | null>(); // Use lean and the correct type


        if (!updatedDespesaDoc) {
            return NextResponse.json({ error: "Falha ao atualizar despesa" }, { status: 500 });
        }


        // Update Google Sheet (if applicable)
        const sheetId = updatedDespesaDoc.empreendimento?.sheetId;
        if (sheetId) {
            const despesaForSheet = {
                _id: updatedDespesaDoc._id.toString(),
                description: updatedDespesaDoc.description,
                value: updatedDespesaDoc.value,
                date: updatedDespesaDoc.date,
                dueDate: updatedDespesaDoc.dueDate,
                status: updatedDespesaDoc.status,
                category: updatedDespesaDoc.category,
                paymentMethod: updatedDespesaDoc.paymentMethod || '',
                notes: updatedDespesaDoc.notes || '',
            };
            try {
                const sheetResult = await updateDespesaInSheet(sheetId, id, despesaForSheet);
                if (!sheetResult.success && 'error' in sheetResult) console.warn('[API PUT Despesa] Falha ao atualizar Google Sheet:', sheetResult.error);
            } catch(sheetError) { console.error('[API PUT Despesa] Erro ao chamar updateDespesaInSheet:', sheetError); }
        }

        // --- Prepare Client Response Object ---
        // Now updatedDespesaDoc is guaranteed to be PopulatedLeanDespesa
        const responseDespesa: ClientDespesa = {
            _id: updatedDespesaDoc._id.toString(), // Safe to call toString()
            description: updatedDespesaDoc.description,
            value: updatedDespesaDoc.value,
            date: updatedDespesaDoc.date instanceof Date ? updatedDespesaDoc.date.toISOString() : new Date().toISOString(),
            dueDate: updatedDespesaDoc.dueDate instanceof Date ? updatedDespesaDoc.dueDate.toISOString() : new Date().toISOString(),
            status: updatedDespesaDoc.status,
            approvalStatus: updatedDespesaDoc.approvalStatus,
            category: updatedDespesaDoc.category,
            notes: updatedDespesaDoc.notes ?? null,
            paymentMethod: updatedDespesaDoc.paymentMethod,
            empreendimento: {
                _id: updatedDespesaDoc.empreendimento?._id.toString() ?? '',
                name: updatedDespesaDoc.empreendimento?.name ?? 'N/A',
            },
            createdBy: updatedDespesaDoc.createdBy ? {
                _id: updatedDespesaDoc.createdBy._id.toString(),
                name: updatedDespesaDoc.createdBy.name,
            } : undefined,
            reviewedBy: updatedDespesaDoc.reviewedBy ? {
                _id: updatedDespesaDoc.reviewedBy._id.toString(),
                name: updatedDespesaDoc.reviewedBy.name,
            } : undefined,
            reviewedAt: updatedDespesaDoc.reviewedAt instanceof Date ? updatedDespesaDoc.reviewedAt.toISOString() : null,
            attachments: updatedDespesaDoc.attachments?.map((att) => ({
                fileId: att.fileId,
                name: att.name,
                url: att.url,
                _id: att._id?.toString(),
            })) ?? [],
            createdAt: updatedDespesaDoc.createdAt instanceof Date ? updatedDespesaDoc.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: updatedDespesaDoc.updatedAt instanceof Date ? updatedDespesaDoc.updatedAt.toISOString() : new Date().toISOString(),
        };


        return NextResponse.json({ despesa: responseDespesa, message: "Despesa atualizada com sucesso." }, { status: 200 });

    } catch (error) {
        console.error(`Erro em PUT /api/despesas/${id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor ao atualizar despesa.';
         if (error instanceof mongoose.Error.ValidationError) { return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 }); }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}


// --- DELETE Handler ---
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!mongoose.isValidObjectId(id)) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role;

        await connectToDatabase();
        const despesaToDelete = await Despesa.findById(id).populate<{ empreendimento: { sheetId?: string } }>('empreendimento', 'sheetId');

        if (!despesaToDelete) {
            return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
        }

        // --- RBAC Check for Deletion ---
        const isCreator = despesaToDelete.createdBy.equals(userId);
        const isPending = despesaToDelete.approvalStatus === 'Pendente';
        const canDelete =
            userRole === 'admin' || // Admin can delete anytime
            (isCreator && isPending); // Creator can delete only if pending approval

        if (!canDelete) {
            return NextResponse.json({ error: 'Você não tem permissão para excluir esta despesa.' }, { status: 403 });
        }
        // --- End RBAC Check ---

        // Delete from DB
        await Despesa.findByIdAndDelete(id);

        // Delete from Google Sheet (if applicable)
        const sheetId = despesaToDelete.empreendimento?.sheetId;
        if (sheetId) {
             try {
                 const sheetResult = await deleteDespesaFromSheet(sheetId, id);
                 if (!sheetResult.success) console.warn(`[API DELETE Despesa] Falha ao excluir do Google Sheet ${sheetId}:`, sheetResult.error);
                 else console.log(`[API DELETE Despesa] Linha referente a ${id} excluída da Sheet ${sheetId}`);
             } catch(sheetError) { console.error('[API DELETE Despesa] Erro ao chamar deleteDespesaFromSheet:', sheetError); }
        } else { console.warn(`[API DELETE Despesa] Sem sheetId para empreendimento. Sheet não atualizada.`); }

        // TODO: Consider deleting attachment from Google Drive? Requires fileId and potentially more complex logic.

        return NextResponse.json({ message: 'Despesa excluída com sucesso', id }, { status: 200 });
    } catch (error) {
        console.error(`Erro em DELETE /api/despesas/${id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor ao excluir despesa.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}