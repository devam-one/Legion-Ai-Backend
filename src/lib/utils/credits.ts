// lib/utils/credits.ts
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function deductCredits(userId: string, amount: number) {
  // Atomic transaction - prevents race conditions
  const result = await db.update(users)
    .set({
      credits_balance: sql`${users.credits_balance} - ${amount}`
    })
    .where(
      sql`${users.id} = ${userId} AND ${users.credits_balance} >= ${amount}`
    )
    .returning();
  
  if (result.length === 0) {
    throw new Error('Insufficient credits');
  }
  
  return result[0];
}
