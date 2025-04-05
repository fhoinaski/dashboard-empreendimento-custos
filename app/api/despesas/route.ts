// FILE: app/api/despesas/route.ts
// STATUS: CORRECTED

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import mongoose, { Types, FilterQuery } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa, Empreendimento, User, DespesaDocument } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { addDespesaToSheet } from '@/lib/google/sheets';
import { uploadFileToDrive } from '@/lib/google/drive';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Interfaces ---
interface PopulatedLeanDespesa extends Omit<DespesaDocument, 'empreendimento' | 'createdBy' | 'reviewedBy'> {
    _id: Types.ObjectId;
    empreendimento?: { _id: Types.ObjectId; name: string; sheetId?: string; folderId?: string };
    createdBy?: { _id: Types.ObjectId; name: string };
    reviewedBy?: { _id: Types.ObjectId; name: string };
    description: string; value: number; date: Date; dueDate: Date;
    status: 'Pago' | 'Pendente' | 'A vencer' | 'Rejeitado';
    approvalStatus: 'Pendente' | 'Aprovado' | 'Rejeitado';
    category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
    paymentMethod?: string; notes?: string;
    attachments?: Array<{ fileId?: string; name?: string; url?: string; _id?: Types.ObjectId }>;
    createdAt: Date; updatedAt: Date; reviewedAt?: Date;
}

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

// Interface for data needed to CREATE a Despesa
interface NewDespesaInputData {
    description: string;
    value: number;
    date: Date; // Must be a Date object
    dueDate: Date; // Must be a Date object
    empreendimento: Types.ObjectId;
    category: 'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros';
    status: 'Pago' | 'Pendente' | 'A vencer';
    paymentMethod?: string;
    notes?: string;
    attachments: Array<{ fileId?: string; name?: string; url?: string }>;
    createdBy: Types.ObjectId;
    approvalStatus: 'Pendente' | 'Aprovado';
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const ITEMS_PER_PAGE = 15;
const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- GET Handler (Restored Mapping Logic) ---
export async function GET(request: Request) {
    console.log("[API GET /api/despesas] Request received.");
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !session.user.role) {
            console.error("[API GET /api/despesas] Unauthorized: No valid session");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role as 'admin' | 'manager' | 'user';
        const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];

        await connectToDatabase();
        console.log("[API GET /api/despesas] DB Connected.");

        // Extrair parâmetros da URL
        const { searchParams } = new URL(request.url);
        const empreendimentoIdParam = searchParams.get('empreendimento');
        const statusValues = searchParams.getAll('status'); // Suporta múltiplos valores
        const categoryParam = searchParams.get('category');
        const approvalStatusParam = searchParams.get('approvalStatus');
        const searchTerm = searchParams.get('q');
        const limitParam = searchParams.get('limit');
        const pageParam = searchParams.get('page');
        const limit = limitParam ? parseInt(limitParam, 10) : ITEMS_PER_PAGE;
        const page = pageParam ? parseInt(pageParam, 10) : 1;
        const skip = (page - 1) * limit;

        // Validação básica
        if (empreendimentoIdParam && empreendimentoIdParam !== 'todos' && !mongoose.isValidObjectId(empreendimentoIdParam)) {
            return NextResponse.json({ error: 'ID de empreendimento inválido.' }, { status: 400 });
        }

        // Construção do filtro
        const filter: FilterQuery<DespesaDocument> = {};

        // Filtro por empreendimento
        if (empreendimentoIdParam && empreendimentoIdParam !== 'todos') {
            filter.empreendimento = new Types.ObjectId(empreendimentoIdParam);
        }

        // Filtro por status financeiro
        const validStatusValues = ['Pago', 'Pendente', 'A vencer', 'Rejeitado'];
        const filteredStatusValues = statusValues.filter(s => s !== 'todos' && validStatusValues.includes(s));
        if (filteredStatusValues.length > 0) {
            filter.status = { $in: filteredStatusValues };
        }

        // Filtro por categoria
        const validCategories = ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'];
        if (categoryParam && categoryParam !== 'todos' && validCategories.includes(categoryParam)) {
            filter.category = categoryParam;
        }

        // Filtro por status de aprovação (apenas para admins)
        if (userRole === 'admin' && approvalStatusParam && approvalStatusParam !== 'todos') {
            const validApprovalStatuses = ['Pendente', 'Aprovado', 'Rejeitado'];
            if (validApprovalStatuses.includes(approvalStatusParam)) {
                filter.approvalStatus = approvalStatusParam;
            }
        }

        // Filtro por termo de busca na descrição
        if (searchTerm) {
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.description = { $regex: escapedSearchTerm, $options: 'i' };
        }

        // Aplicar restrições de RBAC
        let finalFilter: FilterQuery<DespesaDocument> = { ...filter };
        if (userRole === 'user') {
            // Apenas despesas dos empreendimentos atribuídos ao usuário
            finalFilter.empreendimento = {
                $in: userAssignedEmpreendimentos.map(id => new Types.ObjectId(id))
            };
        } else if (userRole === 'manager') {
            // Apenas despesas dos empreendimentos atribuídos ao gerente
            if (userAssignedEmpreendimentos.length > 0) {
                finalFilter.empreendimento = {
                    $in: userAssignedEmpreendimentos.map(id => new Types.ObjectId(id))
                };
            }
        }
        // Admin pode ver tudo, então não aplicamos restrições adicionais

        console.log("[API GET /api/despesas] Final MongoDB filter:", JSON.stringify(finalFilter, null, 2));

        // Buscar dados no MongoDB
        const [despesasDocs, total] = await Promise.all([
            Despesa.find(finalFilter)
                .sort({ dueDate: -1 })
                .limit(limit)
                .skip(skip)
                .populate<{ empreendimento: { _id: Types.ObjectId; name: string } }>("empreendimento", "name _id")
                .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>("createdBy", "name _id")
                .populate<{ reviewedBy: { _id: Types.ObjectId; name: string } }>("reviewedBy", "name _id")
                .lean<PopulatedLeanDespesa[]>(),
            Despesa.countDocuments(finalFilter)
        ]);
        console.log(`[API GET /api/despesas] Found ${despesasDocs.length} documents for page ${page} (Total: ${total}).`);

        // Mapear os documentos para o formato do cliente
        const despesasMapped = despesasDocs
            .map((despesa): ClientDespesa | null => {
                try {
                    if (!despesa?._id || !despesa.empreendimento?._id || !despesa.date || !despesa.dueDate || !despesa.createdAt || !despesa.updatedAt) {
                        console.warn(`[API GET /api/despesas] Skipping despesa ${despesa._id} due to missing essential data`);
                        return null;
                    }
                    const dateObj = new Date(despesa.date);
                    const dueDateObj = new Date(despesa.dueDate);
                    const reviewedAtObj = despesa.reviewedAt ? new Date(despesa.reviewedAt) : null;
                    const createdAtObj = new Date(despesa.createdAt);
                    const updatedAtObj = new Date(despesa.updatedAt);
                    if (isNaN(dateObj.getTime()) || isNaN(dueDateObj.getTime()) || isNaN(createdAtObj.getTime()) || isNaN(updatedAtObj.getTime()) || (reviewedAtObj && isNaN(reviewedAtObj.getTime()))) {
                        console.warn(`[API GET /api/despesas] Skipping despesa ${despesa._id} due to invalid date format`);
                        return null;
                    }

                    return {
                        _id: despesa._id.toString(),
                        description: despesa.description,
                        value: despesa.value,
                        date: dateObj.toISOString(),
                        dueDate: dueDateObj.toISOString(),
                        status: despesa.status,
                        approvalStatus: despesa.approvalStatus,
                        notes: despesa.notes ?? null,
                        empreendimento: {
                            _id: despesa.empreendimento._id.toString(),
                            name: despesa.empreendimento.name ?? 'N/A',
                        },
                        category: despesa.category,
                        paymentMethod: despesa.paymentMethod,
                        createdBy: despesa.createdBy ? {
                            _id: despesa.createdBy._id.toString(),
                            name: despesa.createdBy.name || 'N/A',
                        } : undefined,
                        reviewedBy: despesa.reviewedBy ? {
                            _id: despesa.reviewedBy._id.toString(),
                            name: despesa.reviewedBy.name || 'N/A',
                        } : undefined,
                        reviewedAt: reviewedAtObj?.toISOString() ?? undefined,
                        attachments: despesa.attachments?.filter((att) => att.fileId && att.name).map((att) => ({
                            fileId: att.fileId,
                            name: att.name,
                            url: att.url,
                            _id: att._id?.toString(),
                        })) ?? [],
                        createdAt: createdAtObj.toISOString(),
                        updatedAt: updatedAtObj.toISOString(),
                    };
                } catch (mapError) {
                    console.error(`[API GET /api/despesas] Error mapping despesa ${despesa._id?.toString()}:`, mapError);
                    return null;
                }
            })
            .filter((d): d is ClientDespesa => d !== null);

        console.log(`[API GET /api/despesas] Sending ${despesasMapped.length} mapped despesas.`);
        return NextResponse.json({
            despesas: despesasMapped,
            pagination: { total, limit, page, hasMore: skip + despesasMapped.length < total },
        });

    } catch (error) {
        console.error("[API GET /api/despesas] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
            { status: 500 }
        );
    }
}

// --- POST Handler (Corrected Date/Empreendimento Handling) ---
export async function POST(request: Request) {
    console.log("[API POST /api/despesas] Request received.");
    try {
        const session = await getServerSession(authOptions);
        
        // RBAC Check com verificação de null
        if (!session?.user?.id || !session?.user?.role) {
            console.error("[API POST /despesas] Unauthorized: No valid session");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        
        // Corrigido: Usar operador de encadeamento opcional para evitar erros de null
        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role as 'admin' | 'manager' | 'user';
        const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];

        const formData = await request.formData();
        const empreendimentoIdStr = formData.get('empreendimento') as string;

        // RBAC Check for Creation... (as before)
        if (!mongoose.isValidObjectId(empreendimentoIdStr)) {
            console.error("[API POST /despesas] Invalid empreendimento ID:", empreendimentoIdStr);
            return NextResponse.json({ error: 'ID de empreendimento inválido.' }, { status: 400 });
        }
        const empreendimentoId = new Types.ObjectId(empreendimentoIdStr);
        if (userRole === 'user' && !userAssignedEmpreendimentos.includes(empreendimentoIdStr)) {
            console.error("[API POST /despesas] User not assigned to empreendimento:", empreendimentoIdStr);
            return NextResponse.json({ error: 'Você não tem permissão para criar despesas neste empreendimento.' }, { status: 403 });
        }

        // Extract and Validate Form Data
        const description = formData.get('description') as string;
        const valueStr = formData.get('value') as string;
        const value = valueStr ? parseFloat(valueStr.replace(',', '.')) : NaN;
        const dateStr = formData.get('date') as string;
        const dueDateStr = formData.get('dueDate') as string;
        const statusFromForm = formData.get('status') as string | null;
        const category = formData.get('category') as NewDespesaInputData['category'];
        const paymentMethod = formData.get('paymentMethod') as string | undefined;
        const notes = formData.get('notes') as string | undefined;
        const file = formData.get('file') as File | null;

        let date: Date | undefined;
        let dueDate: Date | undefined;
        // --- FIX: Validate dates and handle error BEFORE assignment ---
        try {
            if (!dateStr || !dueDateStr) throw new Error("Data e Vencimento são obrigatórios.");
            date = new Date(dateStr);
            dueDate = new Date(dueDateStr);
            if (isNaN(date.getTime()) || isNaN(dueDate.getTime())) throw new Error("Formato de data inválido.");
        } catch (dateError: any) {
            console.error("[API POST /despesas] Invalid date format:", { dateStr, dueDateStr });
            return NextResponse.json({ error: dateError.message || 'Datas inválidas.' }, { status: 400 });
        }
        // --- End Fix ---

        // Basic validation... (as before)
        if (!description || isNaN(value) || value <= 0 || !category || !empreendimentoId) {
            console.error("[API POST /despesas] Missing or invalid required fields:", { description, value, category, empreendimentoId });
            return NextResponse.json({ error: 'Campos obrigatórios ausentes ou inválidos.' }, { status: 400 });
        }
        const validFinancialStatuses: Array<'Pago' | 'Pendente' | 'A vencer'> = ['Pago', 'Pendente', 'A vencer'];
        if (!statusFromForm || !validFinancialStatuses.includes(statusFromForm as any)) {
            console.error("[API POST /despesas] Invalid financial status:", statusFromForm);
            return NextResponse.json({ error: `Status financeiro inválido. Valores permitidos: ${validFinancialStatuses.join(", ")}.` }, { status: 400 });
        }
        const finalFinancialStatus = statusFromForm as 'Pago' | 'Pendente' | 'A vencer';
        const validCategories: Array<'Material' | 'Serviço' | 'Equipamento' | 'Taxas' | 'Outros'> = ['Material', 'Serviço', 'Equipamento', 'Taxas', 'Outros'];
        if (!validCategories.includes(category)) {
            console.error("[API POST /despesas] Invalid category:", category);
            return NextResponse.json({ error: `Categoria inválida. Valores permitidos: ${validCategories.join(", ")}.` }, { status: 400 });
        }
        if (file) {
            if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
                console.error("[API POST /despesas] Invalid file type:", file.type);
                return NextResponse.json({ error: `Tipo de arquivo inválido. Tipos permitidos: ${ACCEPTED_FILE_TYPES.join(", ")}.` }, { status: 400 });
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                console.error("[API POST /despesas] File too large:", file.size);
                return NextResponse.json({ error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB.` }, { status: 400 });
            }
        }

        await connectToDatabase();
        const empreendimentoDoc = await Empreendimento.findById(empreendimentoId).select('name folderId sheetId').lean<{ _id: Types.ObjectId; name: string; folderId?: string; sheetId?: string }>();
        // --- FIX: Check if empreendimentoDoc is null ---
        if (!empreendimentoDoc) {
            console.error(`[API POST /despesas] Empreendimento not found: ${empreendimentoIdStr}`);
            return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
        }
        // --- End Fix ---
        console.log(`[API POST /despesas] Empreendimento Found: ${empreendimentoDoc.name}`);

        // Prepare Data for DB
        const despesaDataToSave: NewDespesaInputData = {
            description,
            value,
            date: date!, // <<< FIX: Use non-null assertion here (safe after validation)
            dueDate: dueDate!, // <<< FIX: Use non-null assertion here (safe after validation)
            empreendimento: empreendimentoId,
            category,
            status: finalFinancialStatus,
            paymentMethod: paymentMethod || undefined,
            notes: notes || undefined,
            attachments: [],
            createdBy: userId,
            approvalStatus: userRole === 'admin' ? 'Aprovado' : 'Pendente', // Aprovação automática para admins
            reviewedBy: userRole === 'admin' ? userId : undefined, // Admin é o revisor se aprovar automaticamente
            reviewedAt: userRole === 'admin' ? new Date() : undefined, // Data de revisão se aprovada
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Ajustar o status financeiro com base na aprovação
        if (userRole === 'admin') {
            // Se for admin e a despesa for aprovada automaticamente, ajusta o status
            if (despesaDataToSave.status !== 'Pago') {
                despesaDataToSave.status = 'A vencer';
            }
        }

        // --- FIX: Use safe access for folderId ---
        if (file && empreendimentoDoc.folderId) {
            console.log("[API POST /despesas] Uploading attachment to Drive...");
            try {
                const buffer = Buffer.from(await file.arrayBuffer());
                // --- FIX: Access folderId safely ---
                const uploadResult = await uploadFileToDrive({ buffer, originalname: file.name, mimetype: file.type }, empreendimentoDoc.folderId!, 'Despesas');
                if (uploadResult.success && uploadResult.fileId && uploadResult.fileName && uploadResult.webViewLink) {
                    despesaDataToSave.attachments.push({ fileId: uploadResult.fileId, name: uploadResult.fileName, url: uploadResult.webViewLink });
                    console.log("[API POST /despesas] Attachment uploaded successfully:", uploadResult.fileId);
                } else { console.warn('[API POST /despesas] Failed to upload attachment:', uploadResult.error); }
            } catch (uploadError) { console.error("[API POST /despesas] Error uploading attachment:", uploadError); }
        } else if (file) { console.warn(`[API POST /despesas] File provided but empreendimento ${empreendimentoIdStr} lacks a folderId.`); }
        // --- End Fix ---

        // Create Despesa... (as before)
        console.log("[API POST /despesas] Final data for DB creation:", JSON.stringify(despesaDataToSave, null, 2));
        const newDespesaDoc = await Despesa.create(despesaDataToSave);
        const newDespesa: DespesaDocument & { _id: Types.ObjectId } = newDespesaDoc as any;
        if (!newDespesa || !newDespesa._id) {
            console.error("[API POST /despesas] Failed to create despesa in DB.");
            return NextResponse.json({ error: 'Falha ao criar despesa no banco de dados.' }, { status: 500 });
        }

        // --- Google Sheet Integration ---
        // Adiciona ao Google Sheet apenas se a despesa for aprovada (admins criam como aprovada)
        const sheetId = empreendimentoDoc.sheetId;
        if (newDespesa.approvalStatus === 'Aprovado' && sheetId) {
            console.log(`[API POST /despesas] Approval status is Aprovado & sheetId found. Adding to Google Sheet...`);
            const despesaPlainObject = {
                _id: newDespesa._id.toString(),
                description: newDespesa.description,
                value: newDespesa.value,
                date: newDespesa.date,
                dueDate: newDespesa.dueDate,
                status: newDespesa.status,
                category: newDespesa.category,
                paymentMethod: newDespesa.paymentMethod || '',
                notes: newDespesa.notes || '',
            };
            console.log("[API POST /despesas] Data for Google Sheet:", despesaPlainObject);
            try {
                const sheetResult = await addDespesaToSheet(sheetId, despesaPlainObject);
                if (!sheetResult.success) {
                    console.warn('[API POST /despesas] Failed to add to Google Sheet:', sheetResult.error);
                } else {
                    console.log('[API POST /despesas] Successfully added to Google Sheet.');
                }
            } catch (sheetError) {
                console.error("[API POST /despesas] Error adding to Google Sheet:", sheetError);
            }
        } else {
            console.log(`[API POST /despesas] Skipping Google Sheet update (Approval: ${newDespesa.approvalStatus}, SheetID: ${sheetId}).`);
        }
        // --- End Google Sheet Integration ---

        // Prepare Response
        const creator = await User.findById(userId).select('name').lean();
        const reviewer = userRole === 'admin' ? creator : null;
        
        // Corrigido: Verificar se creator e reviewer têm a estrutura esperada
        const createdDespesaObject: ClientDespesa = {
            _id: newDespesa._id.toString(),
            description: newDespesa.description, 
            value: newDespesa.value,
            date: newDespesa.date.toISOString(), 
            dueDate: newDespesa.dueDate.toISOString(),
            status: newDespesa.status,
            approvalStatus: newDespesa.approvalStatus,
            empreendimento: { 
                _id: empreendimentoDoc._id.toString(), 
                name: empreendimentoDoc.name 
            },
            category: newDespesa.category, 
            paymentMethod: newDespesa.paymentMethod ?? undefined,
            notes: newDespesa.notes ?? null,
            attachments: newDespesa.attachments?.map((att) => ({
                fileId: att.fileId,
                name: att.name,
                url: att.url,
                _id: att._id?.toString()
            })) ?? [],
            createdBy: creator && '_id' in creator ? { 
                _id: creator._id.toString(), 
                name: creator.name || 'N/A' 
            } : undefined,
            reviewedBy: reviewer && '_id' in reviewer ? { 
                _id: reviewer._id.toString(), 
                name: reviewer.name || 'N/A' 
            } : undefined,
            reviewedAt: newDespesa.reviewedAt?.toISOString() ?? undefined,
            createdAt: newDespesa.createdAt.toISOString(),
            updatedAt: newDespesa.updatedAt.toISOString(),
        };
        
        const message = userRole === 'admin' ? 'Despesa criada e aprovada.' : 'Despesa criada e aguardando aprovação.';
        console.log(`[API POST /despesas] Sending success response for ${newDespesa._id}.`);
        return NextResponse.json({ despesa: createdDespesaObject, message }, { status: 201 });

    } catch (error) {
        console.error("[API POST /api/despesas] Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}