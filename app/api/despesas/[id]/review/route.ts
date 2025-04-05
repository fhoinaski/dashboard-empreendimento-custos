// FILE: app/api/despesas/[id]/review/route.ts
// STATUS: CORRECTED

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, User, DespesaDocument, Empreendimento } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { addDespesaToSheet } from '@/lib/google/sheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Interface for the populated and leaned document ---
// This tells TypeScript what shape to expect after .populate().lean()
interface PopulatedLeanReviewedDespesa extends Omit<DespesaDocument, 'empreendimento' | 'createdBy' | 'reviewedBy'> {
    _id: Types.ObjectId; // Mongoose ObjectId before lean might convert it
    empreendimento?: { // Optional because populate might fail or field might not exist
        _id: Types.ObjectId;
        name: string;
        sheetId?: string; // Make sheetId optional as it might not be set
    };
    createdBy?: { // Optional
        _id: Types.ObjectId;
        name: string;
    };
    reviewedBy?: { // Optional
        _id: Types.ObjectId;
        name: string;
    };
    // Include other necessary fields from DespesaDocument
    description: string;
    value: number;
    date: Date;
    dueDate: Date;
    status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado';
    approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado';
    category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
    paymentMethod?: string;
    notes?: string;
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: Types.ObjectId }>; // Keep _id as ObjectId if it exists before lean
    createdAt: Date;
    updatedAt: Date;
    reviewedAt?: Date;
}


// Interface for the expected body of the PUT request
interface ReviewRequestBody {
    approvalStatus: 'Aprovado' | 'Rejeitado';
}

// Interface for ClientDespesa (ensure consistency)
interface ClientDespesa {
    _id: string; description: string; value: number; date: string; dueDate: string;
    status: string; approvalStatus: string; category: string; notes?: string | null; paymentMethod?: string;
    empreendimento: { _id: string; name: string; };
    createdBy?: { _id: string; name: string; };
    reviewedBy?: { _id: string; name: string; };
    reviewedAt?: string | null;
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: string }>;
    createdAt: string; updatedAt: string;
}


export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const expenseId = resolvedParams.id;
    console.log(`[API PUT /api/despesas/${expenseId}/review] Received request.`);

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            console.warn(`[API PUT /review] Unauthorized attempt by user ${session?.user?.id} (Role: ${session?.user?.role}).`);
            return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
        }
        const adminUserId = new Types.ObjectId(session.user.id);
        console.log(`[API PUT /review] Authorized Admin: ${adminUserId}`);

        if (!mongoose.isValidObjectId(expenseId)) {
            console.error(`[API PUT /review] Invalid ID format: ${expenseId}`);
            return NextResponse.json({ error: 'ID de despesa inválido' }, { status: 400 });
        }
        console.log(`[API PUT /review] Valid ID: ${expenseId}`);

        let requestBody: ReviewRequestBody;
        try {
            requestBody = await request.json();
            console.log(`[API PUT /review] Request body parsed:`, requestBody);
        } catch (e) {
            console.error(`[API PUT /review] Error parsing request body:`, e);
            return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const { approvalStatus } = requestBody;
        if (!approvalStatus || !['Aprovado', 'Rejeitado'].includes(approvalStatus)) {
            console.error(`[API PUT /review] Invalid approvalStatus received: ${approvalStatus}`);
            return NextResponse.json({ error: "Status de aprovação inválido. Deve ser 'Aprovado' ou 'Rejeitado'." }, { status: 400 });
        }
        console.log(`[API PUT /review] Valid approvalStatus: ${approvalStatus}`);

        await connectToDatabase();
        console.log(`[API PUT /review] DB Connected.`);

        // Find the expense BEFORE updating to get original status
        const despesaBeforeUpdate = await Despesa.findById(expenseId)
            .select('status approvalStatus') // Only select fields needed for this check
            .lean(); // Use lean is fine here as we only need status

        if (!despesaBeforeUpdate) {
            console.error(`[API PUT /review] Expense not found: ${expenseId}`);
            return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });
        }
        console.log(`[API PUT /review] Expense found. Current status: ${despesaBeforeUpdate.status}, Current approval: ${despesaBeforeUpdate.approvalStatus}`);

        if (despesaBeforeUpdate.approvalStatus !== 'Pendente') {
            console.warn(`[API PUT /review] Expense ${expenseId} already reviewed (Approval: ${despesaBeforeUpdate.approvalStatus}). Cannot re-review.`);
            return NextResponse.json({ error: 'Despesa já foi revisada.' }, { status: 400 });
        }

        // Prepare Update Data
        const updateData: Partial<DespesaDocument> = {
            approvalStatus: approvalStatus,
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
        };

        if (approvalStatus === 'Aprovado') {
            if (despesaBeforeUpdate.status !== 'Pago') {
                updateData.status = 'A vencer';
                console.log(`[API PUT /review] Setting main status to 'A vencer' for approved expense.`);
            } else {
                updateData.status = 'Pago';
                console.log(`[API PUT /review] Keeping main status as 'Pago' for approved expense.`);
            }
        } else { // approvalStatus === 'Rejeitado'
            updateData.status = 'Rejeitado';
            console.log(`[API PUT /review] Setting main status to 'Rejeitado' for rejected expense.`);
        }

        console.log(`[API PUT /review] Update data prepared:`, updateData);

        // --- Update the Document and Populate ---
        const updatedDespesaDoc = await Despesa.findByIdAndUpdate(
            expenseId,
            { $set: updateData },
            { new: true, runValidators: true } // Return the modified document
        )
        // **Chain populate calls AFTER findByIdAndUpdate**
        .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>("createdBy", "name _id")
        .populate<{ reviewedBy: { _id: Types.ObjectId; name: string } }>("reviewedBy", "name _id")
        .populate<{ empreendimento: { _id: Types.ObjectId; name: string; sheetId?: string } }>("empreendimento", "name _id sheetId"); // Ensure sheetId is populated here

        if (!updatedDespesaDoc) {
            console.error(`[API PUT /review] Failed to update expense ${expenseId} after finding it.`);
            return NextResponse.json({ error: 'Despesa não encontrada durante a atualização.' }, { status: 404 });
        }

        // **Use lean() AFTER population and apply the specific type hint**
        const updatedDespesa = updatedDespesaDoc.toObject() as PopulatedLeanReviewedDespesa; // Cast to the lean type after converting

        console.log(`[API PUT /review] Expense ${expenseId} updated successfully in DB. New Status: ${updatedDespesa.status}, Approval: ${updatedDespesa.approvalStatus}`);

        // --- Google Sheet Integration (ONLY ON APPROVAL) ---
        if (approvalStatus === 'Aprovado') {
            // **Access sheetId safely using optional chaining** (Error 1 Fix)
            const sheetId = updatedDespesa.empreendimento?.sheetId;
            console.log(`[API PUT /review] Empreendimento Sheet ID from updatedDespesa: ${sheetId}`);

            if (sheetId) {
                console.log(`[API PUT /review] Preparing data for Google Sheet ADD (ID: ${expenseId}). Status to send: ${updatedDespesa.status}`);
                 // Prepare data using the correctly typed updatedDespesa object
                 const despesaForSheet = {
                     // **Access _id safely (Error 2 Fix)** - .toString() is valid on ObjectId
                     _id: updatedDespesa._id.toString(),
                     description: updatedDespesa.description || '',
                     value: updatedDespesa.value,
                     date: updatedDespesa.date, // Pass Date object
                     dueDate: updatedDespesa.dueDate, // Pass Date object
                     status: updatedDespesa.status,
                     category: updatedDespesa.category || '',
                     paymentMethod: updatedDespesa.paymentMethod || '',
                     notes: updatedDespesa.notes || '',
                 };
                 console.log(`[API PUT /review] Data (raw) for Google Sheet add:`, JSON.stringify(despesaForSheet));

                 try {
                     const sheetResult = await addDespesaToSheet(sheetId, despesaForSheet);
                     if (!sheetResult.success) {
                         console.error('[API PUT /review] Failed to ADD to Google Sheet:', sheetResult.error);
                     } else {
                         console.log(`[API PUT /review] Google Sheet ADDED successfully.`);
                     }
                 } catch (sheetError) {
                     console.error('[API PUT /review] EXCEPTION calling addDespesaToSheet:', sheetError);
                 }
            } else {
                console.warn(`[API PUT /review] No sheetId found for empreendimento ${updatedDespesa.empreendimento?._id?.toString()}. Sheet not updated.`);
            }
        } else {
             console.log(`[API PUT /review] Expense rejected. Skipping Google Sheet update.`);
        }
        // --- End Google Sheet Integration ---

        // --- Prepare Response Object ---
        // Now TypeScript knows the structure of updatedDespesa
        const responseDespesa: ClientDespesa = {
            // **Access _id safely (Error 3 Fix)**
            _id: updatedDespesa._id.toString(),
            description: updatedDespesa.description,
            value: updatedDespesa.value,
            date: updatedDespesa.date instanceof Date ? updatedDespesa.date.toISOString() : '',
            dueDate: updatedDespesa.dueDate instanceof Date ? updatedDespesa.dueDate.toISOString() : '',
            status: updatedDespesa.status,
            approvalStatus: updatedDespesa.approvalStatus,
            empreendimento: updatedDespesa.empreendimento ? {
                _id: updatedDespesa.empreendimento._id.toString(),
                // **Access name safely (Error 4 Fix)**
                name: updatedDespesa.empreendimento.name,
            } : { _id: '', name: 'N/A' },
            category: updatedDespesa.category,
            paymentMethod: updatedDespesa.paymentMethod ?? undefined,
            notes: updatedDespesa.notes ?? null,
            createdBy: updatedDespesa.createdBy ? {
                _id: updatedDespesa.createdBy._id.toString(),
                // **Access name safely (Error 5 Fix)**
                name: updatedDespesa.createdBy.name,
            } : undefined,
            reviewedBy: updatedDespesa.reviewedBy ? {
                _id: updatedDespesa.reviewedBy._id.toString(),
                // **Access name safely (Error 6 Fix)**
                name: updatedDespesa.reviewedBy.name,
            } : undefined,
            reviewedAt: updatedDespesa.reviewedAt instanceof Date ? updatedDespesa.reviewedAt.toISOString() : null,
            attachments: updatedDespesa.attachments?.map((att: any) => ({
                fileId: att.fileId, name: att.name, url: att.url, _id: att._id?.toString(),
            })) ?? [],
            createdAt: updatedDespesa.createdAt instanceof Date ? updatedDespesa.createdAt.toISOString() : '',
            updatedAt: updatedDespesa.updatedAt instanceof Date ? updatedDespesa.updatedAt.toISOString() : '',
        };
        // --- End Response Preparation ---

        console.log(`[API PUT /review] Sending success response for expense ${expenseId}.`);
        const successMessage = approvalStatus === 'Aprovado' ? 'Despesa aprovada com sucesso.' : 'Despesa rejeitada com sucesso.';
        return NextResponse.json({ message: successMessage, despesa: responseDespesa }, { status: 200 });

    // --- General Error Handling ---
    } catch (error) {
        console.error(`[API PUT /api/despesas/${expenseId}/review] General Error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno durante a revisão';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}