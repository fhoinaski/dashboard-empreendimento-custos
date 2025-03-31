// app/api/notifications/summary/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { startOfDay, endOfDay, addDays } from 'date-fns';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        // Garante que apenas usuários autenticados possam acessar
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        await connectToDatabase();

        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const next7DaysEnd = endOfDay(addDays(todayStart, 7)); // Vencem nos próximos 7 dias

        // Critérios:
        // 1. Status NÃO é 'Pago'
        // 2. OU dueDate é ANTES de hoje (Atrasada)
        // 3. OU dueDate está ENTRE hoje e os próximos 7 dias (Próxima do vencimento)
        const relevantUnpaidCount = await Despesa.countDocuments({
             status: { $ne: 'Pago' }, // Não está Pago
             $or: [
                 { dueDate: { $lt: todayStart } }, // Atrasada
                 { dueDate: { $gte: todayStart, $lte: next7DaysEnd } } // Vence hoje ou nos próximos 7 dias
             ],
            // Opcional: Filtrar por usuário se necessário
            // createdBy: session.user.id // Descomente se as despesas forem por usuário
        });

        // Se precisar filtrar por IDs lidos no backend (mais complexo):
        // const readIdsParam = new URL(request.url).searchParams.get('readIds');
        // const readIds = readIdsParam ? JSON.parse(readIdsParam) : [];
        // query._id = { $nin: readIds }; // Exclui os IDs lidos

        return NextResponse.json({ unreadCount: relevantUnpaidCount });

    } catch (error) {
        console.error('Erro ao buscar sumário de notificações:', error);
        // Retorna 0 em caso de erro para não quebrar o frontend
        return NextResponse.json({ unreadCount: 0, error: 'Erro interno do servidor' }, { status: 500 });
    }
}