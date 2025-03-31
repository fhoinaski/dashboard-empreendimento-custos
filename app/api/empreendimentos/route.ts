// app/api/empreendimentos/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { Empreendimento } from '@/lib/db/models'; // Importa o modelo Empreendimento
import { authOptions } from '@/lib/auth/options';
import mongoose, { PipelineStage, Types } from 'mongoose';
// --- Import the actual functions ---
import { uploadFileToS3 } from '@/lib/s3';
import { createEmpreendimentoSheet } from '@/lib/google/sheets';
import { createEmpreendimentoFolders } from '@/lib/google/drive';
// --- End Import ---


// --- INTERFACES (Mover para types/index.ts se não existirem lá) ---
interface EmpreendimentoFilter {
    status?: string;
    type?: string;
    name?: { $regex: string; $options: string };
}
interface AggregatedEmpreendimento {
    _id: Types.ObjectId; name: string; address: string; type: string; status: string; totalUnits: number;
    soldUnits: number; startDate: Date; endDate: Date; description?: string; responsiblePerson: string;
    contactEmail: string; contactPhone: string; image?: string; folderId?: string; sheetId?: string;
    createdAt: Date; updatedAt: Date;
    pendingExpensesCount: number; totalExpensesValue: number;
}
interface ClientEmpreendimento { // Interface para a lista principal
    _id: string; name: string; address: string; type: string; status: string; totalUnits: number;
    soldUnits: number; startDate: string; endDate: string; description?: string; responsiblePerson: string;
    contactEmail: string; contactPhone: string; image?: string; folderId?: string; sheetId?: string;
    pendingExpenses: number; totalExpenses: number; createdAt: string; updatedAt: string;
}
interface EmpreendimentoOption { // Interface para o dropdown
    _id: string;
    name: string;
}

// Define interface for S3 Upload Result (if not defined globally)
interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
    fileName?: string; // Optional: Add if your s3 function returns it
}

// Define interface for Google Sheet Result (if not defined globally)
interface SheetResult {
    success: boolean;
    spreadsheetId?: string;
    url?: string;
    error?: string;
}

// Define interface for Google Drive Folder Result (if not defined globally)
interface DriveFolderResult {
    success: boolean;
    empreendimentoFolderId?: string;
    categoryFolders?: Record<string, string>;
    error?: string;
}

// --- FIM INTERFACES ---

export async function GET(request: Request) {
    console.log("[API GET /api/empreendimentos] Recebida requisição.");
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            console.warn("[API GET /api/empreendimentos] Não autorizado (sem sessão).");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        console.log("[API GET /api/empreendimentos] Sessão OK.");

        await connectToDatabase();
        console.log("[API GET /api/empreendimentos] Conectado ao DB.");
        const { searchParams } = new URL(request.url);

        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const searchTerm = searchParams.get('q');
        const limitParam = searchParams.get('limit'); // Pega como string
        const page = parseInt(searchParams.get('page') || '1', 10);

        // Verifica se é uma requisição para popular dropdown (limit alto)
        const isDropdownFetch = limitParam && parseInt(limitParam, 10) >= 999;
        const limit = limitParam ? parseInt(limitParam, 10) : 10; // Default limit para lista normal
        const skip = (page - 1) * limit;

        console.log("[API GET /api/empreendimentos] Params:", { status, type, searchTerm, limit: limitParam, page, isDropdownFetch });

        const filter: EmpreendimentoFilter = {};
        if (status && status !== 'todos') filter.status = status;
        if (type && type !== 'todos') filter.type = type;
        if (searchTerm) filter.name = { $regex: searchTerm, $options: 'i' };
        console.log("[API GET /api/empreendimentos] Filtro MongoDB:", filter);

        // --- Lógica Otimizada para Dropdown ---
        if (isDropdownFetch) {
            console.log("[API GET /api/empreendimentos] Detectada requisição para dropdown (limit >= 999). Buscando apenas _id e name.");
            // Lean expects a plain object structure, ensure EmpreendimentoOption matches lean result
            const empreendimentoOptions = await Empreendimento.find(filter)
                .select('_id name')
                .sort({ name: 1 })
                .limit(999)
                .lean<{ _id: Types.ObjectId; name: string }[]>(); // Use the expected lean type

            console.log(`[API GET /api/empreendimentos] Encontrados ${empreendimentoOptions.length} empreendimentos para dropdown.`);

             return NextResponse.json({
                 empreendimentos: empreendimentoOptions.map(e => ({ _id: e._id.toString(), name: e.name })), // Map _id to string here
                 pagination: { total: empreendimentoOptions.length, limit: 999, page: 1, hasMore: false }
             });
        }
        // --- Fim Lógica Dropdown ---


        // --- Lógica Original com Agregação para a Lista Principal ---
        console.log("[API GET /api/empreendimentos] Executando agregação completa para lista...");
        const aggregationPipeline: PipelineStage[] = [
            { $match: filter },
            { $lookup: { from: 'despesas', localField: '_id', foreignField: 'empreendimento', as: 'relatedExpenses' } },
            { $addFields: {
                pendingExpensesCount: {
                    $size: {
                         $filter: {
                            input: '$relatedExpenses', as: 'expense',
                            cond: { $in: ['$$expense.status', ['Pendente', 'A vencer']] }
                         }
                    }
                 },
                totalExpensesValue: { $sum: '$relatedExpenses.value' }
               }
            },
            { $project: { relatedExpenses: 0 } },
            { $sort: { updatedAt: -1 } },
            { $facet: {
                 paginatedResults: [{ $skip: skip }, { $limit: limit }],
                 totalCount: [{ $count: 'count' }]
               }
            }
        ];

        const results = await Empreendimento.aggregate(aggregationPipeline);
        console.log("[API GET /api/empreendimentos] Agregação concluída.");

        const empreendimentosAggregated: AggregatedEmpreendimento[] = results[0]?.paginatedResults || [];
        const total = results[0]?.totalCount[0]?.count || 0;
        console.log(`[API GET /api/empreendimentos] Encontrados ${empreendimentosAggregated.length} (total: ${total}) via agregação.`);

        const clientEmpreendimentos: ClientEmpreendimento[] = empreendimentosAggregated.map(emp => ({
            _id: emp._id.toString(), name: emp.name, address: emp.address, type: emp.type, status: emp.status,
            totalUnits: emp.totalUnits, soldUnits: emp.soldUnits, startDate: emp.startDate.toISOString(),
            endDate: emp.endDate.toISOString(), description: emp.description, responsiblePerson: emp.responsiblePerson,
            contactEmail: emp.contactEmail, contactPhone: emp.contactPhone, image: emp.image, folderId: emp.folderId,
            sheetId: emp.sheetId,
            pendingExpenses: emp.pendingExpensesCount || 0,
            totalExpenses: emp.totalExpensesValue || 0,
            createdAt: emp.createdAt.toISOString(), updatedAt: emp.updatedAt.toISOString(),
        }));

        console.log("[API GET /api/empreendimentos] Enviando resposta da agregação.");
        return NextResponse.json({
            empreendimentos: clientEmpreendimentos,
            pagination: { total, limit, page, hasMore: skip + clientEmpreendimentos.length < total },
        });

    } catch (error) {
        console.error('[API GET /api/empreendimentos] Erro GERAL:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar empreendimentos';
        return NextResponse.json({ error: 'Erro interno ao buscar empreendimentos', details: errorMessage }, { status: 500 });
    }
}

// --- POST ---
export async function POST(request: Request) {
    console.log("API POST /api/empreendimentos chamado");
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.log("API POST /api/empreendimentos: Não autorizado");
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        console.log("API POST /api/empreendimentos: Sessão OK, User ID:", session.user.id);

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

        // --- Validações ---
        if (!name || !address || !type || !status || !totalUnitsStr || !soldUnitsStr || !startDateStr || !endDateStr || !responsiblePerson || !contactEmail || !contactPhone) {
            console.log("API POST /api/empreendimentos: Campos obrigatórios faltando");
            return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
        }
        const totalUnits = parseInt(totalUnitsStr, 10);
        const soldUnits = parseInt(soldUnitsStr, 10);
        if (isNaN(totalUnits) || totalUnits < 0 || isNaN(soldUnits) || soldUnits < 0 || soldUnits > totalUnits) {
             console.log("API POST /api/empreendimentos: Valores de unidades inválidos");
             return NextResponse.json({ error: 'Valores de unidades inválidos.' }, { status: 400 });
         }
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
         if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
            console.log("API POST /api/empreendimentos: Datas inválidas");
            return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
         }
         console.log("API POST /api/empreendimentos: Validações OK");

        // --- Upload de Imagem S3 ---
        let imageUrl: string | undefined;
        if (file) {
            console.log(`API POST /api/empreendimentos: Processando imagem ${file.name}`);
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; // Added webp
            if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Tipo de arquivo inválido (JPEG, PNG, GIF, WEBP).' }, { status: 400 });
            if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB).' }, { status: 400 });

            const buffer = Buffer.from(await file.arrayBuffer());

            // --- REMOVED 'declare' line ---
            // Use the imported uploadFileToS3 function
            const uploadResult: UploadResult = await uploadFileToS3(
                { buffer, originalname: file.name, mimetype: file.type },
                process.env.AWS_S3_BUCKET_NAME || ''
            );

            if (uploadResult.success && uploadResult.url) {
                imageUrl = uploadResult.url;
                console.log("API POST /api/empreendimentos: Upload S3 OK, URL:", imageUrl);
            } else {
                console.error('API POST /api/empreendimentos: Falha no upload S3:', uploadResult.error);
                // Optionally return error if image upload fails
                // return NextResponse.json({ error: 'Falha ao fazer upload da imagem', details: uploadResult.error }, { status: 500 });
            }
        }

        await connectToDatabase();
        console.log("API POST /api/empreendimentos: Conectado ao DB.");

        // --- Objeto Inicial para Criação ---
        // Use correct type for createdBy
        const initialData = {
            name, address, status, type, totalUnits, soldUnits, startDate, endDate, description,
            responsiblePerson, contactEmail, contactPhone, image: imageUrl,
            createdBy: new Types.ObjectId(session.user.id), // Ensure createdBy is ObjectId
            sheetId: undefined as string | undefined, // Initialize as undefined with type hint
            folderId: undefined as string | undefined, // Initialize as undefined with type hint
        };

        // --- Integração Google ANTES de salvar no DB ---
        const tempEmpreendimentoId = new Types.ObjectId(); // Generate temporary ID for Google integration
        // initialData._id = tempEmpreendimentoId; // Assign temp ID if needed by Google functions

        let googleSheetId: string | undefined;
        let googleFolderId: string | undefined;
        let sheetUrl: string | undefined;

        console.log("API POST /api/empreendimentos: Iniciando integração Google para ID (temp):", tempEmpreendimentoId.toString());
        try {
            // --- REMOVED 'declare' lines ---
            // Use the imported Google functions
            const [sheetResult, driveResult] = await Promise.all([
                createEmpreendimentoSheet(tempEmpreendimentoId.toString(), name),
                createEmpreendimentoFolders(tempEmpreendimentoId.toString(), name),
            ]);

            if (sheetResult?.success && sheetResult.spreadsheetId) {
                googleSheetId = sheetResult.spreadsheetId;
                sheetUrl = sheetResult.url;
                console.log("API POST /api/empreendimentos: Planilha Google criada:", googleSheetId);
            } else {
                console.warn("API POST /api/empreendimentos: Falha ao criar Planilha Google:", sheetResult?.error);
            }

            if (driveResult?.success && driveResult.empreendimentoFolderId) {
                googleFolderId = driveResult.empreendimentoFolderId;
                console.log("API POST /api/empreendimentos: Pastas Google Drive criadas:", googleFolderId);
            } else {
                console.warn("API POST /api/empreendimentos: Falha ao criar Pastas Google Drive:", driveResult?.error);
            }

            initialData.sheetId = googleSheetId;
            initialData.folderId = googleFolderId;

        } catch (googleError) {
            console.error("API POST /api/empreendimentos: Erro crítico durante integração Google:", googleError);
            // Decide if you want to proceed without Google integration or return an error
            // return NextResponse.json({ error: 'Erro interno durante integração com Google', details: (googleError as Error).message }, { status: 500 });
            // For now, let's log and continue without setting IDs if integration fails
            initialData.sheetId = undefined;
            initialData.folderId = undefined;
        }

        // --- Criação no MongoDB ---
        // Pass initialData which now includes Google IDs (or undefined if failed)
        console.log("API POST /api/empreendimentos: Criando no MongoDB com dados:", initialData);
        // We don't need to pass _id here, let MongoDB generate it unless strictly required by logic
        // Remove initialData._id assignment if not needed
        const newEmpreendimento = await Empreendimento.create(initialData);
        console.log("API POST /api/empreendimentos: Criado no DB, ID:", newEmpreendimento._id);

        const responseData = {
            empreendimento: newEmpreendimento.toObject(),
            sheetUrl: sheetUrl // Return sheet URL if created
        };

        return NextResponse.json(responseData, { status: 201 });

    } catch (error) {
        console.error('Erro em API POST /api/empreendimentos:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        if (error instanceof mongoose.Error.ValidationError) {
            return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Erro interno ao criar empreendimento', details: errorMessage }, { status: 500 });
    }
}