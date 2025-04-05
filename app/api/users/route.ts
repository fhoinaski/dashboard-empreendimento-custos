import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { User, Empreendimento, UserDocument } from '@/lib/db/models'; // Import UserDocument
import { authOptions } from '@/lib/auth/options';
import mongoose, { Types } from 'mongoose'; // Import Types

// Interface para o objeto retornado ao cliente
interface ClientAssignedEmpreendimento {
    _id: string;
    name: string;
}

interface ClientUser {
    _id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    assignedEmpreendimentos: ClientAssignedEmpreendimento[]; // Usar a interface aqui
}

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.role || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '10', 10);
        const searchTerm = searchParams.get('q') || '';
        const skip = (page - 1) * limit;

        const filter: mongoose.FilterQuery<UserDocument> = {}; // Usar UserDocument
        if (searchTerm) {
            const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapar caracteres regex
            filter.$or = [
                { name: { $regex: escapedSearchTerm, $options: 'i' } },
                { email: { $regex: escapedSearchTerm, $options: 'i' } },
            ];
        }

        // Usar .lean<UserDocument[]>() para obter objetos JS puros com tipagem
        const usersDocs = await User.find(filter)
            .select('name email role createdAt assignedEmpreendimentos')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean<UserDocument[]>(); // Aplicar a tipagem correta aqui

        const clientUsers: ClientUser[] = []; // Tipar o array final

        for (const user of usersDocs) {
            // Inicializar com a tipagem correta para assignedEmpreendimentos
            const userData: ClientUser = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
                assignedEmpreendimentos: [] // Inicializa como array vazio do tipo correto
            };

            if (user.assignedEmpreendimentos && Array.isArray(user.assignedEmpreendimentos) && user.assignedEmpreendimentos.length > 0) {
                try {
                    // Garantir que IDs são válidos ObjectId antes de buscar
                    const validEmpIds = user.assignedEmpreendimentos
                        .filter(id => mongoose.isValidObjectId(id))
                        .map(id => typeof id === 'string' ? new Types.ObjectId(id) : id); // Converter string para ObjectId se necessário

                    if (validEmpIds.length > 0) {
                        const empreendimentos = await Empreendimento.find({
                            _id: { $in: validEmpIds }
                        }).select('_id name').lean();

                        // Atribuição agora é segura pois o tipo foi definido na inicialização
                        userData.assignedEmpreendimentos = empreendimentos.map(emp => ({
                            _id: emp._id.toString(),
                            name: emp.name
                        }));
                    }
                } catch (err) {
                    console.error(`Erro ao buscar empreendimentos para ${user.email}:`, err);
                    // Mantém o array vazio em caso de erro
                }
            }

            clientUsers.push(userData);
        }

        const total = await User.countDocuments(filter);

        return NextResponse.json({
            users: clientUsers,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return NextResponse.json(
            { error: 'Erro interno ao buscar usuários', details: error instanceof Error ? error.message : 'Erro desconhecido' },
            { status: 500 }
        );
    }
}