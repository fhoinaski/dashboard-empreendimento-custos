import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types, Document } from 'mongoose'; // Added Document for type definitions
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento } from '@/lib/db/models'; // Import Models
import { authOptions } from '@/lib/auth/options'; // Import authOptions
import { uploadFileToDrive, deleteFileFromDrive } from '@/lib/google/drive'; // Import Drive functions
import { updateDespesaInSheet, deleteDespesaFromSheet } from '@/lib/google/sheets'; // Import Sheets functions

// --- INTERFACES (Define missing types here or move to a shared types file) ---
interface Attachment {
    _id?: Types.ObjectId | string; // Optional _id from MongoDB
    fileId?: string;
    name?: string;
    url?: string;
}

// Interface for a populated Empreendimento (adjust fields as needed)
interface PopulatedEmpreendimento extends Document { // Extend Mongoose Document
    _id: Types.ObjectId;
    name: string;
    sheetId?: string;
    folderId?: string;
    // Add other fields if populated and accessed
    toObject(): any; // Add toObject method signature
}

// Interface for a populated Despesa
interface PopulatedDespesa extends Document { // Extend Mongoose Document
    _id: Types.ObjectId;
    description: string;
    value: number;
    date: Date;
    dueDate: Date;
    status: string;
    category: string;
    paymentMethod?: string;
    notes?: string;
    empreendimento?: PopulatedEmpreendimento | null; // Reference populated empreendimento
    attachments?: Attachment[];
    createdAt: Date;
    updatedAt: Date;
    // Add other fields if needed (createdBy, etc.)
    toObject(): any; // Add toObject method signature
}

// Interface for update data in PUT request
interface DespesaUpdateData {
    updatedAt: Date;
    description?: string;
    value?: number;
    date?: Date;
    dueDate?: Date;
    status?: string;
    category?: string;
    paymentMethod?: string | null; // Allow null if optional
    notes?: string | null; // Allow null if optional
    // attachments are handled separately via $push
}
// --- END INTERFACES ---

// --- GET ---
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions); // Use imported authOptions
        if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

        const { id } = await params;

        if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

        await connectToDatabase();
        // Use PopulatedDespesa type hint here
        const despesa: PopulatedDespesa | null = await Despesa.findById(id) // Use imported Despesa model
            .populate<{ empreendimento: PopulatedEmpreendimento }>('empreendimento', 'name sheetId folderId'); // Use PopulatedEmpreendimento type

        if (!despesa) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 });

        return NextResponse.json({ despesa: despesa.toObject() }); // Use toObject for plain JS object
    } catch (error) {
        console.error('Erro ao buscar despesa:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: 'Erro ao buscar despesa', details: errorMessage }, { status: 500 });
    }
}

// --- PUT ---
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
   
    try {
        const session = await getServerSession(authOptions); // Use imported authOptions
       
        if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

         const { id } = await params;

        if (!mongoose.isValidObjectId(id)) {
            console.error(`ID inválido: ${id}`);
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const formData = await request.formData();
       
        for (const [key, value] of formData.entries()) {
           
        }

        const description = formData.get('description')?.toString();
        const valueStr = formData.get('value')?.toString();
        const value = valueStr ? parseFloat(valueStr.replace(',', '.')) : NaN; // Handle comma as decimal separator
        const dateStr = formData.get('date')?.toString();
        const dueDateStr = formData.get('dueDate')?.toString();
        const status = formData.get('status')?.toString();
        const category = formData.get('category')?.toString();
        const paymentMethod = formData.get('paymentMethod')?.toString();
        const notes = formData.get('notes')?.toString();
        const file = formData.get('file') as File | null;

        // Use DespesaUpdateData type
        const updateData: DespesaUpdateData = {
            updatedAt: new Date(),
        };
        if (description !== undefined) updateData.description = description;
        if (!isNaN(value)) updateData.value = value;
        // Parse dates carefully
        try {
            if (dateStr) updateData.date = new Date(dateStr);
            if (dueDateStr) updateData.dueDate = new Date(dueDateStr);
            if ((updateData.date && isNaN(updateData.date.getTime())) || (updateData.dueDate && isNaN(updateData.dueDate.getTime()))) {
                throw new Error("Formato de data inválido recebido.");
            }
        } catch (dateError) {
            console.error("Erro ao parsear datas:", dateError);
            return NextResponse.json({ error: 'Formato de data inválido.' }, { status: 400 });
        }

        if (status) updateData.status = status;
        if (category) updateData.category = category;
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod || null; // Use null for empty optional string
        if (notes !== undefined) updateData.notes = notes || null; // Use null for empty optional string

    

        
        // Use PopulatedDespesa type
        const existingDespesa: PopulatedDespesa | null = await Despesa.findById(id) // Use Despesa model
            .populate<{ empreendimento: PopulatedEmpreendimento }>('empreendimento', 'sheetId folderId name'); // Populate name as well
        if (!existingDespesa) {
            console.error(`Despesa não encontrada para ID: ${id}`);
            return NextResponse.json({ error: 'Despesa não encontrada para atualização' }, { status: 404 });
        }

        const empreendimento = existingDespesa.empreendimento?.toObject(); // Use toObject() safely
        

        // Handle file upload if provided
        let attachmentResult: Attachment | null = null; // Use Attachment type
        if (file && empreendimento?.folderId) {
           
            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                // Use imported uploadFileToDrive
                const uploadResult = await uploadFileToDrive(
                    { buffer, originalname: file.name, mimetype: file.type },
                    empreendimento.folderId,
                    'Despesas' // Assumindo que a categoria é Despesas para o anexo
                );

                if (uploadResult.success && uploadResult.fileId && uploadResult.webViewLink && uploadResult.fileName) {
                    attachmentResult = { // Assign to Attachment type
                        fileId: uploadResult.fileId,
                        name: uploadResult.fileName,
                        url: uploadResult.webViewLink,
                    };
                    // Adiciona o novo anexo ao array existente
                    // You might want to remove old attachments here if replacing
                    await Despesa.findByIdAndUpdate(id, { $push: { attachments: attachmentResult } }); // Use Despesa model
                 
                } else {
                    console.warn('Falha ao fazer upload do anexo:', uploadResult.error || 'Dados ausentes');
                    // Consider returning an error or warning to the user
                    // return NextResponse.json({ error: 'Falha ao fazer upload do anexo', details: uploadResult.error }, { status: 500 });
                }
            } catch (uploadError) {
                console.error("Erro durante upload do anexo:", uploadError);
                 // Consider returning an error or warning to the user
                 // return NextResponse.json({ error: 'Erro interno durante upload do anexo' }, { status: 500 });
            }
        } else if (file && !empreendimento?.folderId) {
             console.warn(`Tentativa de upload de anexo para despesa ${id}, mas o empreendimento não possui folderId.`);
        }

        // Perform the main update operation
        
        // Use PopulatedDespesa type
        const updatedDespesa: PopulatedDespesa | null = await Despesa.findByIdAndUpdate( // Use Despesa model
            id,
            updateData, // Pass the update data object
            { new: true, runValidators: true }
        ).populate<{ empreendimento: PopulatedEmpreendimento }>('empreendimento', 'sheetId folderId name'); // Populate name too

        if (!updatedDespesa) {
            console.error(`Falha ao atualizar despesa ${id}: não encontrada após tentativa`);
            return NextResponse.json({ error: 'Falha ao atualizar a despesa (não encontrada após tentativa)' }, { status: 404 });
        }
        console.log(`Despesa ${id} atualizada no MongoDB`);

        // Update Google Sheet if sheetId exists
        const updatedEmpreendimentoObj = updatedDespesa.empreendimento?.toObject(); // Use toObject()
        const sheetId = updatedEmpreendimentoObj?.sheetId;

        if (sheetId) {
             console.log(`Tentando atualizar despesa ${id} na planilha ${sheetId}`);
             try {
                // Prepare the plain object for the sheet function
                const despesaForSheet = {
                    _id: updatedDespesa._id.toString(),
                    description: updatedDespesa.description,
                    value: updatedDespesa.value,
                    date: updatedDespesa.date,
                    dueDate: updatedDespesa.dueDate,
                    status: updatedDespesa.status,
                    category: updatedDespesa.category,
                    paymentMethod: updatedDespesa.paymentMethod || '',
                    notes: updatedDespesa.notes || '',
                };

                 // Use imported updateDespesaInSheet
                 const sheetResult = await updateDespesaInSheet(sheetId, id, despesaForSheet);
                 if (!sheetResult.success) {
                     console.warn('Falha ao atualizar despesa na planilha:', sheetResult.error);
                     // Consider not failing the whole request, maybe return a partial success message
                 } else {
                     console.log(`Despesa ${id} atualizada na planilha com sucesso na linha ${sheetResult.updatedRow}`);
                 }
             } catch (sheetError) {
                 console.error('Erro ao interagir com a planilha:', sheetError);
                  // Consider not failing the whole request
             }
        } else {
             console.warn(`Nenhum sheetId encontrado para o empreendimento associado à despesa ${id}`);
        }

        // Prepare the final response object
        const finalDespesaObject = updatedDespesa.toObject();
        // Ensure the newly added attachment is included if it was uploaded in this request
        if (attachmentResult && !finalDespesaObject.attachments?.some((att: Attachment) => att.fileId === attachmentResult?.fileId)) {
             finalDespesaObject.attachments = [...(finalDespesaObject.attachments || []), attachmentResult];
        }

        return NextResponse.json({
            despesa: finalDespesaObject,
            attachment: attachmentResult, // Returns info of the attachment just added (if any)
        });

    } catch (error) {
        console.error('Erro ao atualizar despesa:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: 'Erro interno ao atualizar despesa', details: errorMessage }, { status: 500 });
    }
}


// --- DELETE ---
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
     try {
         const session = await getServerSession(authOptions); // Use imported authOptions
         if (!session) {
             return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
         }

         const { id } = await params;

         if (!mongoose.isValidObjectId(id)) {
             return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
         }

         await connectToDatabase();

         // Fetch the expense BEFORE deleting to get sheetId and attachments
         // Use PopulatedDespesa type
         const despesa: PopulatedDespesa | null = await Despesa.findById(id) // Use Despesa model
             .populate<{ empreendimento: PopulatedEmpreendimento }>('empreendimento', 'sheetId'); // Only need sheetId

         if (!despesa) {
             return NextResponse.json({ error: 'Despesa não encontrada para exclusão' }, { status: 404 });
         }

         const sheetId = despesa.empreendimento?.sheetId;
         const attachments = despesa.attachments || []; // Ensure it's an array

         // --- Delete from Sheet ---
         if (sheetId) {
             console.log(`[DELETE /api/despesas/${id}] Tentando excluir da planilha ${sheetId}`);
             try {
                 // Use imported deleteDespesaFromSheet
                 const sheetResult = await deleteDespesaFromSheet(sheetId, id);
                 if (!sheetResult.success) {
                     console.warn(`[DELETE /api/despesas/${id}] Falha ao excluir da planilha:`, sheetResult.error);
                     // Continue even if sheet deletion fails
                 } else {
                      console.log(`[DELETE /api/despesas/${id}] Excluído da planilha (linha ${sheetResult.deletedRow}).`);
                 }
             } catch (sheetError) {
                 console.error(`[DELETE /api/despesas/${id}] Erro ao interagir com planilha para exclusão:`, sheetError);
             }
         } else {
              console.log(`[DELETE /api/despesas/${id}] Nenhuma planilha associada para excluir.`);
         }

         // --- Delete Attachments from Drive ---
         if (attachments.length > 0) {
             console.log(`[DELETE /api/despesas/${id}] Excluindo ${attachments.length} anexo(s) do Drive...`);
             try {
                 const deletionPromises = attachments.map(async (attachment: Attachment) => { // Use Attachment type
                     if (attachment.fileId) {
                         console.log(`  -> Excluindo Drive ID: ${attachment.fileId}`);
                         // Use imported deleteFileFromDrive
                         const deleteResult = await deleteFileFromDrive(attachment.fileId);
                         if (!deleteResult.success) {
                             console.warn(`     Falha ao excluir anexo ${attachment.name || attachment.fileId}: ${deleteResult.error}`);
                         }
                         return deleteResult;
                     }
                     return { success: true }; // Skip if no fileId
                 });
                 await Promise.all(deletionPromises);
                 console.log(`[DELETE /api/despesas/${id}] Exclusão de anexos do Drive concluída (ou tentada).`);
             } catch (driveError) {
                 console.error(`[DELETE /api/despesas/${id}] Erro durante exclusão de anexos do Drive:`, driveError);
                 // Continue even if Drive deletion fails
             }
         } else {
              console.log(`[DELETE /api/despesas/${id}] Nenhum anexo para excluir do Drive.`);
         }

         // --- Delete from MongoDB ---
         console.log(`[DELETE /api/despesas/${id}] Excluindo do MongoDB...`);
         await Despesa.findByIdAndDelete(id); // Use Despesa model
         console.log(`[DELETE /api/despesas/${id}] Excluído do MongoDB com sucesso.`);

         return NextResponse.json({ message: 'Despesa excluída com sucesso', id });

     } catch (error) {
         console.error(`[DELETE /api/despesas/{id}] Erro geral:`, error);
         const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao excluir despesa';
         return NextResponse.json({ error: 'Erro interno ao excluir despesa', details: errorMessage }, { status: 500 });
     }
 }

