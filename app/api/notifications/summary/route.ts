/* ================================== */
/*  app/api/notifications/summary/route.ts */
/* ================================== */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectToDatabase from '@/lib/db/mongodb';
import { Despesa } from '@/lib/db/models';
import { authOptions } from '@/lib/auth/options';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import mongoose, { Types, FilterQuery } from 'mongoose';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || !session.user.role) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const userId = new Types.ObjectId(session.user.id);
        const userRole = session.user.role;
        const userAssignedEmpreendimentos = session.user.assignedEmpreendimentos || [];

        await connectToDatabase();

        const todayStart = startOfDay(new Date());
        const next7DaysEnd = endOfDay(addDays(todayStart, 7)); // Example range: due within 7 days or overdue

        // --- Build Role-Specific Query ---
        const baseQuery: FilterQuery<any> = {};
        // Add dueDate filter only if needed for performance, but filtering by status is primary
        // baseQuery.dueDate = { $lte: next7DaysEnd }; // Due within 7 days or overdue

        if (userRole === 'admin') {
            // Admin sees pending approval OR approved & upcoming/overdue
            baseQuery.$or = [
                { approvalStatus: 'Pendente' }, // Needs review
                { status: 'A vencer', dueDate: { $lte: next7DaysEnd } } // Approved but not paid, due soon or overdue
            ];
            console.log("[API Notif Summary] Admin Query:", JSON.stringify(baseQuery));
        } else if (userRole === 'manager') {
            // Manager sees THEIR own pending approval OR THEIR own rejected
             baseQuery.createdBy = userId;
             baseQuery.approvalStatus = { $in: ['Pendente', 'Rejeitado'] };
             console.log("[API Notif Summary] Manager Query:", JSON.stringify(baseQuery));
        } else if (userRole === 'user') {
            // User sees ONLY THEIR own pending approval OR THEIR own rejected
             baseQuery.createdBy = userId;
             baseQuery.approvalStatus = { $in: ['Pendente', 'Rejeitado'] };
             console.log("[API Notif Summary] User Query:", JSON.stringify(baseQuery));
        } else {
             // Unknown role sees nothing
             console.warn(`[API Notif Summary] Unknown role: ${userRole}`);
             return NextResponse.json({ unreadCount: 0 });
        }

        // Count documents matching the role-specific query
        const relevantCount = await Despesa.countDocuments(baseQuery);

        // Note: This count still doesn't subtract locally 'read' notifications.
        // The context handles the final 'unread' count displayed to the user.
        return NextResponse.json({ unreadCount: relevantCount });

    } catch (error) {
        console.error('Erro ao buscar sumário de notificações:', error);
        return NextResponse.json({ unreadCount: 0, error: 'Erro interno do servidor' }, { status: 500 });
    }
}