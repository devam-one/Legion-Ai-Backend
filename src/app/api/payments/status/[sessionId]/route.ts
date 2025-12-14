// src/app/api/payments/status/[sessionId]/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { credit_transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await params;

    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [transaction] = await db
            .select()
            .from(credit_transactions)
            .where(eq(credit_transactions.session_id, sessionId))
            .limit(1);

        if (!transaction) {
            return NextResponse.json(
                { error: 'Transaction not found' },
                { status: 404 }
            );
        }

        // Verify ownership
        if (transaction.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            session_id: transaction.session_id,
            status: transaction.status,
            credits_amount: transaction.credits_amount,
            amount_paid: transaction.amount_paid,
            created_at: transaction.created_at,
            completed_at: transaction.completed_at,
        });

    } catch (error) {
        console.error('Status check error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
