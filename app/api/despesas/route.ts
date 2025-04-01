// app/api/despesas/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types, FilterQuery } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento } from '@/lib/db/models'; // Ensure Empreendimento is needed or remove
import { authOptions } from '@/lib/auth/options';
import { addDespesaToSheet } from '@/lib/google/sheets'; // Needed for POST
import { uploadFileToDrive } from '@/lib/google/drive'; // Needed for POST

// Define the structure for the client-side despesa data
// Ideally, move this to a shared types file (e.g., 'types/index.ts')
interface ClientDespesa {
    _id: string;
    description: string;
    value: number;
    date: string; // ISO string format
    dueDate: string; // ISO string format
    status: string;
    notes?: string | null; 
    empreendimento: {
        _id: string;
        name: string;
    };
    category: string;
    paymentMethod?: string;
    createdBy?: string; // Usually ObjectId string
    attachments?: Array<{ // Ensure it's an array
        fileId?: string;
        name?: string;
        url?: string;
        _id?: string; // Optional MongoDB subdocument ID
    }>;
    createdAt: string; // ISO string format
    updatedAt: string; // ISO string format
}

// Interface for data expected when creating a new Despesa (used in POST)
// Not strictly necessary if using 'any', but good practice
interface NewDespesaData {
    description: string;
    value: number;
    date: Date;
    dueDate: Date;
    status: string;
    empreendimento: Types.ObjectId | string; // Allow string initially, convert later if needed
    category: string;
    paymentMethod?: string | null;
    notes?: string | null;
    createdBy: Types.ObjectId | string; // Assuming user ID is string or convert
    attachments: Array<{
        fileId?: string;
        name?: string;
        url?: string;
    }>;
}

// Define ITEMS_PER_PAGE constant
const ITEMS_PER_PAGE = 15;

// --- API Route Handlers ---

export async function GET(request: Request) {
    
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.warn("[API GET /api/despesas] Não autorizado.");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        

        await connectToDatabase();
        

        const { searchParams } = new URL(request.url);
        const empreendimentoId = searchParams.get('empreendimento');
        const statusParam = searchParams.get('status'); // Can be multiple, handle getAll
        const categoryParam = searchParams.get('category');
        const searchTerm = searchParams.get('q');
        const limitParam = searchParams.get('limit');
        const pageParam = searchParams.get('page');

        const limit = limitParam ? parseInt(limitParam, 10) : ITEMS_PER_PAGE;
        const page = pageParam ? parseInt(pageParam, 10) : 1;
        const skip = (page - 1) * limit;

      

        // --- Build Mongoose Filter ---
        const filter: FilterQuery<typeof Despesa> = {};
        if (empreendimentoId && empreendimentoId !== 'todos' && mongoose.isValidObjectId(empreendimentoId)) {
            filter.empreendimento = new Types.ObjectId(empreendimentoId);
        } else if (empreendimentoId && empreendimentoId !== 'todos') {
             console.warn(`[API GET /api/despesas] ID Empreendimento inválido: ${empreendimentoId}`);
             // Return empty list for invalid ID to prevent errors client-side
             return NextResponse.json({ despesas: [], pagination: { total: 0, limit, page, hasMore: false } });
        }

        // Handle multiple statuses if the API allows (e.g., ?status=Pendente&status=A%20vencer)
        const statusValues = searchParams.getAll('status');
        if (statusValues.length > 0 && !statusValues.includes('todos')) {
            // Validate each status value if necessary
            const validStatuses = statusValues.filter(s => ['Pago', 'Pendente', 'A vencer'].includes(s));
            if (validStatuses.length > 0) {
                filter.status = { $in: validStatuses };
            }
        } else if (statusParam && statusParam !== 'todos' && statusValues.length === 1 && ['Pago', 'Pendente', 'A vencer'].includes(statusParam)) {
             // Fallback for single status param if getAll isn't used client-side
             filter.status = statusParam;
        }

        if (categoryParam && categoryParam !== 'todos' && ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'].includes(categoryParam)) {
            filter.category = categoryParam;
        }
        if (searchTerm) {
            // Escape special regex characters in search term for safety
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.description = { $regex: escapedSearchTerm, $options: 'i' };
        }
        // Optional: Filter by user
        // filter.createdBy = new Types.ObjectId(session.user.id);

       

        // --- Fetch Data and Count ---
        const [despesasRaw, total] = await Promise.all([
            Despesa.find(filter)
                .sort({ dueDate: -1 }) // Default sort by due date descending
                .limit(limit)
                .skip(skip)
                .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>("empreendimento", "name _id") // Populate only necessary fields
                .lean<any[]>(), // Use lean for performance, type as any[] or create LeanDocument type
            Despesa.countDocuments(filter)
        ]);
      

        // --- Transform Data for Client ---
        const despesasMapped = despesasRaw.map((despesa): ClientDespesa | null => {
            // Basic validation
            if (!despesa?._id || !despesa.empreendimento?._id || !despesa.date || !despesa.dueDate) {
                 console.warn("Skipping despesa due to missing essential data (_id, empreendimento._id, date, or dueDate):", despesa?._id);
                 return null;
            }
            try {
                // Ensure dates are valid before converting to ISOString
                const dateObj = new Date(despesa.date);
                const dueDateObj = new Date(despesa.dueDate);
                if (isNaN(dateObj.getTime()) || isNaN(dueDateObj.getTime())) {
                    console.warn(`Skipping despesa ${despesa._id} due to invalid date format.`);
                    return null;
                }

                return {
                    _id: despesa._id.toString(),
                    description: despesa.description,
                    value: despesa.value,
                    date: dateObj.toISOString(),
                    dueDate: dueDateObj.toISOString(),
                    status: despesa.status,
                    empreendimento: {
                        _id: despesa.empreendimento._id.toString(),
                        name: despesa.empreendimento.name,
                    },
                    category: despesa.category,
                    paymentMethod: despesa.paymentMethod ?? undefined,
                    createdBy: despesa.createdBy?.toString() ?? undefined,
                    attachments: despesa.attachments?.filter((att: any) => att.fileId && att.name).map((att: any) => ({
                        fileId: att.fileId,
                        name: att.name,
                        url: att.url ?? undefined, // Make URL optional
                        _id: att._id?.toString() ?? undefined // Make _id optional
                    })) ?? [],
                    createdAt: new Date(despesa.createdAt).toISOString(),
                    updatedAt: new Date(despesa.updatedAt).toISOString(),
                };
            } catch (mapError) {
                 console.error(`Error mapping despesa ${despesa._id}:`, mapError);
                 return null;
            }
        }).filter((d): d is ClientDespesa => d !== null); // Filter out any nulls from mapping/validation

        // --- Return Response ---
        return NextResponse.json({
            despesas: despesasMapped,
            pagination: {
                total,
                limit,
                page,
                hasMore: skip + despesasMapped.length < total,
            },
        });

    } catch (error) {
        console.error('[API GET /api/despesas] Erro:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar despesas';
        // Return an empty list on error to avoid breaking the frontend list component
        return NextResponse.json({
             error: 'Erro interno ao buscar despesas',
             details: errorMessage,
             despesas: [], // Provide empty array on error
             pagination: { total: 0, limit: ITEMS_PER_PAGE, page: 1, hasMore: false }
        }, { status: 500 });
    }
}


export async function POST(request: Request) {
    
    try {
        const session = await getServerSession(authOptions);
       
        if (!session?.user?.id) {
            console.error("Usuário não autenticado");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const formData = await request.formData();
       
        for (const [key, value] of formData.entries()) {
           
        }

        // --- Extract and Parse Data ---
        const description = formData.get('description') as string;
        const valueStr = formData.get('value') as string;
        // Handle comma or dot as decimal separator robustly
        const value = valueStr ? parseFloat(valueStr.replace(',', '.')) : NaN;
        const dateStr = formData.get('date') as string;
        const dueDateStr = formData.get('dueDate') as string;
        let date: Date | undefined;
        let dueDate: Date | undefined;

        try {
            // Attempt to parse dates. Ensure they are valid Date objects.
            if (dateStr) date = new Date(dateStr);
            if (dueDateStr) dueDate = new Date(dueDateStr);
            if ((date && isNaN(date.getTime())) || (dueDate && isNaN(dueDate.getTime()))) {
                throw new Error("Formato de data inválido fornecido.");
            }
        } catch (dateError) {
             console.error("Erro ao parsear datas do formData:", dateError);
             return NextResponse.json({ error: 'Formato de data inválido.' }, { status: 400 });
        }

        const status = formData.get('status') as string;
        const empreendimentoId = formData.get('empreendimento') as string;
        const category = formData.get('category') as string;
        const paymentMethod = formData.get('paymentMethod') as string | undefined;
        const notes = formData.get('notes') as string | undefined;
        const file = formData.get('file') as File | null;

        // --- Validation ---
        if (!description || isNaN(value) || value <= 0 || !date || !dueDate || !status || !empreendimentoId || !category) {
            console.error("Validação falhou: Campos obrigatórios faltando, inválidos ou valor não positivo.");
            return NextResponse.json({ error: 'Campos obrigatórios faltando, inválidos ou valor não positivo.' }, { status: 400 });
        }
        if (!mongoose.isValidObjectId(empreendimentoId)) {
            console.error(`ID de empreendimento inválido: ${empreendimentoId}`);
            return NextResponse.json({ error: 'ID de empreendimento inválido.' }, { status: 400 });
        }
        if (!['Pago', 'Pendente', 'A vencer'].includes(status)) {
            return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
        }
        if (!['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'].includes(category)) {
            return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 });
        }
        if (file) {
             // Optional: Add file type/size validation here if needed before uploading
             const allowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
             const maxSize = 10 * 1024 * 1024; // 10MB
             if (!allowedTypes.includes(file.type)) {
                 return NextResponse.json({ error: `Tipo de arquivo inválido (${file.type}). Permitidos: PDF, JPG, PNG, GIF.` }, { status: 400 });
             }
             if (file.size > maxSize) {
                 return NextResponse.json({ error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.` }, { status: 400 });
             }
        }
        // --- End Validation ---

      

        // --- Fetch Empreendimento Details ---
       
        const empreendimentoDoc = await Empreendimento.findById(empreendimentoId)
             .select('name folderId sheetId') // Select necessary fields
             .lean<{ _id: Types.ObjectId; name: string; folderId?: string; sheetId?: string }>();

        if (!empreendimentoDoc) {
            console.error(`Empreendimento não encontrado para ID: ${empreendimentoId}`);
            return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
        }
       

        // --- Prepare Despesa Data for DB ---
        // Use the validated Date objects
        const newDespesaData: NewDespesaData = {
            description, value, date, dueDate, status,
            empreendimento: empreendimentoId,
            category,
            paymentMethod: paymentMethod || undefined, // Store undefined if empty
            notes: notes || undefined, // Store undefined if empty
            createdBy: session.user.id, // Convert to ObjectId if your schema requires it
            attachments: [], // Initialize empty
        };

        // --- Handle File Upload ---
        let attachmentResult: { fileId?: string; name?: string; url?: string } | null = null;
        if (file && empreendimentoDoc.folderId) {
            
            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                const uploadResult = await uploadFileToDrive(
                    { buffer, originalname: file.name, mimetype: file.type },
                    empreendimentoDoc.folderId,
                    'Despesas' // Specific subfolder in Drive
                );
                if (uploadResult.success && uploadResult.fileId && uploadResult.fileName && uploadResult.webViewLink) {
                    attachmentResult = { fileId: uploadResult.fileId, name: uploadResult.fileName, url: uploadResult.webViewLink };
                    newDespesaData.attachments.push(attachmentResult);
                  
                } else {
                    console.warn('Falha ao fazer upload do anexo para Drive:', uploadResult.error);
                    // Potentially return error or add warning to response
                }
            } catch (uploadError) {
                console.error("Erro durante upload do anexo para Drive:", uploadError);
                // Potentially return error
            }
        } else if (file && !empreendimentoDoc.folderId) {
             console.warn(`Tentativa de upload para despesa, mas Empreendimento ${empreendimentoId} não tem folderId configurado.`);
        }

        // --- Create Despesa in MongoDB ---
     
        const newDespesa = await Despesa.create(newDespesaData);
   

        // --- Add to Google Sheet ---
        const sheetId = empreendimentoDoc.sheetId;
        if (sheetId) {
        
            const despesaPlainObject = {
                _id: newDespesa._id.toString(),
                description: newDespesa.description,
                value: newDespesa.value,
                date: newDespesa.date, // Pass Date object
                dueDate: newDespesa.dueDate, // Pass Date object
                status: newDespesa.status,
                category: newDespesa.category,
                paymentMethod: newDespesa.paymentMethod || '',
                notes: newDespesa.notes || '',
            };

            try {
                const sheetResult = await addDespesaToSheet(sheetId, despesaPlainObject);
                if (!sheetResult.success) {
                     console.error('Falha ao adicionar despesa à planilha Google:', sheetResult.error);
                } else {
                   
                }
            } catch (sheetError) {
                console.error('Erro ao chamar addDespesaToSheet:', sheetError);
            }
        } else {
            console.warn(`Nenhum sheetId para empreendimento ${empreendimentoId}. Planilha não atualizada.`);
        }

        // --- Prepare Response ---
        const createdDespesaObject: ClientDespesa = {
            _id: newDespesa._id.toString(),
            description: newDespesa.description,
            value: newDespesa.value,
            date: newDespesa.date.toISOString(),
            dueDate: newDespesa.dueDate.toISOString(),
            status: newDespesa.status,
            empreendimento: {
                _id: empreendimentoDoc._id.toString(),
                name: empreendimentoDoc.name,
            },
            category: newDespesa.category,
            paymentMethod: newDespesa.paymentMethod ?? undefined,
            notes: newDespesa.notes ?? undefined,
            attachments: newDespesa.attachments?.map((att: any) => ({
                 fileId: att.fileId, name: att.name, url: att.url, _id: att._id?.toString(),
            })) ?? [],
            createdBy: newDespesa.createdBy?.toString() ?? undefined,
            createdAt: newDespesa.createdAt.toISOString(),
            updatedAt: newDespesa.updatedAt.toISOString(),
        };

       
        return NextResponse.json({ despesa: createdDespesaObject, message: 'Despesa criada com sucesso' }, { status: 201 });

    } catch (error) {
        console.error('Erro ao criar despesa:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao criar despesa';
        if (error instanceof mongoose.Error.ValidationError) {
            return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Erro interno ao criar despesa', details: errorMessage }, { status: 500 });
    }
}