/* ================================== */
/*   app/api/empreendimentos/route.ts   */
/* ================================== */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento, User } from '@/lib/db/models'; // Import User
import { authOptions } from '@/lib/auth/options';
import mongoose, { PipelineStage, Types, FilterQuery } from 'mongoose';
import { uploadFileToS3 } from '@/lib/s3';
import { createEmpreendimentoSheet } from '@/lib/google/sheets';
import { createEmpreendimentoFolders } from '@/lib/google/drive';

// Interface for client-side display
interface ClientEmpreendimento {
    _id: string; name: string; address: string; type: string; status: string;
    totalUnits: number; soldUnits: number; startDate: string; endDate: string;
    description?: string; responsiblePerson: string; contactEmail: string; contactPhone: string;
    image?: string; folderId?: string; sheetId?: string;
    pendingExpenses?: number; // Count of 'Pendente' or 'A Vencer'
    totalExpenses?: number;   // Sum of 'Pago' or 'A Vencer'
    createdAt: string; updatedAt: string;
}

// --- GET: List/Dropdown Empreendimentos ---
export async function GET(request: Request) {
    console.log("[API GET /api/empreendimentos] Received request.");
    try {
        const session = await getServerSession(authOptions);
        // --- RBAC CHECK: Allow Authenticated Users ---
        // Modificado: Permite qualquer usuário autenticado buscar, a lógica de filtro decidirá o que retornar.
        if (!session?.user?.id || !session.user.role) {
            console.warn("[API GET /empreendimentos] Unauthorized access attempt.");
            // Retorna lista vazia se não autenticado
            return NextResponse.json({ empreendimentos: [], pagination: { total: 0, limit: 10, page: 1, hasMore: false } });
        }
        // --- END RBAC CHECK ---

        const userRole = session.user.role;
        const userId = session.user.id;
        // Busca os IDs atribuídos da sessão e converte para ObjectId
        const userAssignedEmpreendimentos = (session.user.assignedEmpreendimentos || [])
            .filter(id => mongoose.isValidObjectId(id))
            .map(id => new Types.ObjectId(id));

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const searchTerm = searchParams.get('q');
        const limitParam = searchParams.get('limit');
        const isDropdownFetch = limitParam && parseInt(limitParam, 10) >= 999; // Usado para buscar apenas ID/Nome
        const limit = isDropdownFetch ? 999 : (limitParam ? parseInt(limitParam, 10) : 10);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const skip = (page - 1) * limit;

        // --- Filtro Base (Status, Tipo, Busca) ---
        const baseFilter: FilterQuery<any> = {};
        if (status && status !== 'todos') baseFilter.status = status;
        if (type && type !== 'todos') baseFilter.type = type;
        if (searchTerm) baseFilter.name = { $regex: searchTerm, $options: 'i' };

        // --- Filtro Final baseado na Role ---
        let finalFilter: FilterQuery<any> = { ...baseFilter }; // Começa com o filtro base

        if (userRole === 'user') {
            // Usuário 'user' só vê os atribuídos que correspondem aos outros filtros
            console.log(`[API GET /empreendimentos] User role detected. Filtering by assigned IDs:`, userAssignedEmpreendimentos.map(id => id.toString()));
            finalFilter = {
                $and: [
                    baseFilter, // Aplica filtros de status/tipo/busca
                    { _id: { $in: userAssignedEmpreendimentos } } // E o ID deve estar na lista de atribuídos
                ]
            };
        } else if (userRole === 'admin' || userRole === 'manager') {
            // Admin e Manager veem todos (respeitando os filtros base)
            console.log(`[API GET /empreendimentos] ${userRole} role detected. Applying base filters only.`);
            // finalFilter já é baseFilter neste caso
        } else {
            // Role desconhecida, não retorna nada
            console.warn(`[API GET /empreendimentos] Unknown user role: ${userRole}. Returning empty.`);
            return NextResponse.json({ empreendimentos: [], pagination: { total: 0, limit: limit, page: 1, hasMore: false } });
        }

        console.log(`[API GET /empreendimentos] Final MongoDB filter:`, JSON.stringify(finalFilter));


        // --- Dropdown Fetch (ID and Name Only, respeitando o filtro final) ---
        if (isDropdownFetch) {
            console.log("[API GET /empreendimentos] Fetching for dropdown with final filter.");
            const empreendimentoOptions = await Empreendimento.find(finalFilter) // Usa o filtro final
                .select('_id name')
                .sort({ name: 1 })
                .limit(999)
                .lean();
            console.log(`[API GET /empreendimentos] Dropdown fetch found ${empreendimentoOptions.length} options.`);
            return NextResponse.json({
                // Retorna apenas _id e name para o dropdown
                empreendimentos: empreendimentoOptions.map(e => ({ _id: e._id.toString(), name: e.name })),
                pagination: { total: empreendimentoOptions.length, limit: 999, page: 1, hasMore: false }
            });
        }

        // --- Full List Fetch (Aggregation, respeitando o filtro final) ---
        console.log("[API GET /empreendimentos] Fetching full list with final filter.");
        const aggregationPipeline: PipelineStage[] = [
            { $match: finalFilter }, // Usa o filtro final
            // O restante da agregação continua igual...
            { $lookup: { from: 'despesas', localField: '_id', foreignField: 'empreendimento', as: 'relatedExpenses' } },
            {
                $addFields: {
                    pendingExpensesCount: { $size: { $filter: { input: '$relatedExpenses', as: 'expense', cond: { $in: ['$$expense.status', ['Pendente', 'A vencer']] } } } },
                    totalExpensesValue: { $sum: { $map: { input: { $filter: { input: '$relatedExpenses', as: 'expense', cond: { $in: ['$$expense.status', ['Pago', 'A vencer']] } } }, as: "approvedExpense", in: "$$approvedExpense.value" } } }
                }
            },
            { $project: { relatedExpenses: 0 } },
            { $sort: { updatedAt: -1 } },
            { $facet: {
                paginatedResults: [{ $skip: skip }, { $limit: limit }],
                totalCount: [{ $count: 'count' }]
            }}
        ];

        const results = await Empreendimento.aggregate(aggregationPipeline);
        const empreendimentosAggregated = results[0]?.paginatedResults || [];
        const total = results[0]?.totalCount[0]?.count || 0;
        console.log(`[API GET /empreendimentos] Full list fetch found ${empreendimentosAggregated.length} results (total: ${total}).`);

        // Map to client format (sem alterações aqui)
        const clientEmpreendimentos = empreendimentosAggregated.map((emp: any): ClientEmpreendimento => ({
            _id: emp._id.toString(), name: emp.name ?? 'N/A', address: emp.address ?? 'N/A', type: emp.type ?? 'N/A', status: emp.status ?? 'N/A',
            totalUnits: emp.totalUnits ?? 0, soldUnits: emp.soldUnits ?? 0,
            startDate: emp.startDate ? new Date(emp.startDate).toISOString() : new Date().toISOString(),
            endDate: emp.endDate ? new Date(emp.endDate).toISOString() : new Date().toISOString(),
            description: emp.description, responsiblePerson: emp.responsiblePerson ?? 'N/A',
            contactEmail: emp.contactEmail ?? 'N/A', contactPhone: emp.contactPhone ?? 'N/A',
            image: emp.image, folderId: emp.folderId, sheetId: emp.sheetId,
            pendingExpenses: emp.pendingExpensesCount || 0,
            totalExpenses: emp.totalExpensesValue || 0,
            createdAt: emp.createdAt ? new Date(emp.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: emp.updatedAt ? new Date(emp.updatedAt).toISOString() : new Date().toISOString(),
        }));

        return NextResponse.json({
            empreendimentos: clientEmpreendimentos,
            pagination: { total, limit, page, hasMore: skip + clientEmpreendimentos.length < total },
        });

    } catch (error) {
        console.error('[API GET /api/empreendimentos] General Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return NextResponse.json({ error: 'Erro interno ao buscar empreendimentos', details: errorMessage }, { status: 500 });
    }
}

// --- POST Handler (sem alterações significativas necessárias para este problema) ---
// ... (código do POST continua igual) ...
export async function POST(request: Request) {
    console.log("API POST /api/empreendimentos called");
    try {
        const session = await getServerSession(authOptions);
        // --- RBAC CHECK: ADMIN ONLY ---
        if (!session?.user?.id || session.user.role !== 'admin') {
            console.warn("[API POST /empreendimentos] Unauthorized - Only admin can create.");
            return NextResponse.json({ error: 'Apenas administradores podem criar empreendimentos.' }, { status: 403 });
        }
        // --- END RBAC CHECK ---

        const formData = await request.formData();
        const name = formData.get('name') as string;
        const address = formData.get('address') as string;
        const status = formData.get('status') as string;
        const type = formData.get('type') as string;
        const totalUnitsStr = formData.get('totalUnits') as string;
        const soldUnitsStr = formData.get('soldUnits') as string;
        const startDateStr = formData.get('startDate') as string;
        const endDateStr = formData.get('endDate') as string;
        const description = formData.get('description') as string;
        const responsiblePerson = formData.get('responsiblePerson') as string;
        const contactEmail = formData.get('contactEmail') as string;
        const contactPhone = formData.get('contactPhone') as string;
        const file = formData.get('image') instanceof File ? formData.get('image') as File : null;

        // Basic validation
        if (!name || !address || !type || !status || !totalUnitsStr || !soldUnitsStr || !startDateStr || !endDateStr || !responsiblePerson || !contactEmail || !contactPhone) {
            return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
        }
        const totalUnits = parseInt(totalUnitsStr, 10);
        const soldUnits = parseInt(soldUnitsStr, 10);
         if (isNaN(totalUnits) || totalUnits < 0 || isNaN(soldUnits) || soldUnits < 0 || soldUnits > totalUnits) {
             return NextResponse.json({ error: 'Valores de unidades inválidos.' }, { status: 400 });
         }
         const startDate = new Date(startDateStr);
         const endDate = new Date(endDateStr);
         if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
             return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
         }

        let imageUrl: string | undefined;
        if (file) {
             const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
             if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Tipo de arquivo inválido (JPEG, PNG, GIF, WEBP).' }, { status: 400 });
             if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 400 });

             const buffer = Buffer.from(await file.arrayBuffer());
             const bucketName = process.env.AWS_S3_BUCKET_NAME;
              if (!bucketName) {
                  console.error("AWS_S3_BUCKET_NAME não configurado!");
                  return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
              }
             const uploadResult = await uploadFileToS3({ buffer, originalname: file.name, mimetype: file.type }, bucketName);
             if (uploadResult.success && uploadResult.url) {
                 imageUrl = uploadResult.url;
             } else { console.warn("Falha no upload da imagem para S3:", uploadResult.error); }
        }

        await connectToDatabase();

        // Create temporary ID *before* Google integration to use it consistently
        const tempEmpreendimentoId = new mongoose.Types.ObjectId();
        let googleSheetId: string | undefined;
        let googleFolderId: string | undefined;
        let sheetUrl: string | undefined;

        // Google Integration (Sheet & Drive)
        console.log(`[POST /empreendimentos] Tentando criar recursos Google para ${name} (ID: ${tempEmpreendimentoId})...`);
        try {
            const [sheetResult, driveResult] = await Promise.all([
                createEmpreendimentoSheet(tempEmpreendimentoId.toString(), name),
                createEmpreendimentoFolders(tempEmpreendimentoId.toString(), name),
            ]);
             if (sheetResult?.success && sheetResult.spreadsheetId) { googleSheetId = sheetResult.spreadsheetId; sheetUrl = sheetResult.url; } else { console.warn("[POST /empreendimentos] Falha ao criar Google Sheet:", sheetResult?.error); }
             if (driveResult?.success && driveResult.empreendimentoFolderId) { googleFolderId = driveResult.empreendimentoFolderId; } else { console.warn("[POST /empreendimentos] Falha ao criar Google Drive Folder:", driveResult?.error); }
        } catch (googleError: any) { console.error("[POST /empreendimentos] Erro na integração com Google:", googleError); }

        // Create Empreendimento in DB using the temporary ID
        console.log("[POST /empreendimentos] Criando empreendimento no MongoDB com ID:", tempEmpreendimentoId);
        const newEmpreendimento = await Empreendimento.create({
            _id: tempEmpreendimentoId, // Use the pre-generated ID
            name, address, status, type, totalUnits, soldUnits,
            startDate, endDate, description, responsiblePerson,
            contactEmail, contactPhone, image: imageUrl,
            createdBy: new mongoose.Types.ObjectId(session.user.id),
            sheetId: googleSheetId,
            folderId: googleFolderId,
        });
        console.log(`[POST /empreendimentos] Empreendimento ${newEmpreendimento._id} criado no MongoDB.`);

        // Prepare response (ensure dates are ISO strings)
        const responseData = {
             empreendimento: {
                _id: newEmpreendimento._id.toString(),
                name: newEmpreendimento.name,
                address: newEmpreendimento.address,
                type: newEmpreendimento.type,
                status: newEmpreendimento.status,
                totalUnits: newEmpreendimento.totalUnits,
                soldUnits: newEmpreendimento.soldUnits,
                startDate: newEmpreendimento.startDate.toISOString(),
                endDate: newEmpreendimento.endDate.toISOString(),
                responsiblePerson: newEmpreendimento.responsiblePerson,
                image: newEmpreendimento.image,
                folderId: newEmpreendimento.folderId,
                sheetId: newEmpreendimento.sheetId,
                createdAt: newEmpreendimento.createdAt.toISOString(),
                updatedAt: newEmpreendimento.updatedAt.toISOString(),
             },
             sheetUrl: sheetUrl
        };
        return NextResponse.json(responseData, { status: 201 });

    } catch (error) {
        console.error('Erro em API POST /api/empreendimentos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        if (error instanceof mongoose.Error.ValidationError) return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
        return NextResponse.json({ error: 'Erro interno ao criar empreendimento', details: errorMessage }, { status: 500 });
    }
}