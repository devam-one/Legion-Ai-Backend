// lib/utils/credits.ts
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Cost per AI generation type
 */
export const CREDIT_COSTS = {
  image: 10,
  video: 50,
  text: 5,
} as const;

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(
  userId: string, 
  requiredCredits: number
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { credits_balance: true },
  });

  return user ? user.credits_balance >= requiredCredits : false;
}

/**
 * Deduct credits from user (atomic operation)
 * Returns the new balance or throws error if insufficient
 */
export async function deductCredits(
  userId: string,
  amount: number
): Promise<number> {
  // Atomic update - prevents race conditions
  const [result] = await db
    .update(users)
    .set({
      credits_balance: sql`${users.credits_balance} - ${amount}`,
      updated_at: new Date(),
    })
    .where(
      sql`${users.id} = ${userId} AND ${users.credits_balance} >= ${amount}`
    )
    .returning({ credits_balance: users.credits_balance });

  if (!result) {
    throw new Error('Insufficient credits');
  }

  return result.credits_balance;
}

/**
 * Add credits to user (for purchases/refunds)
 */
export async function addCredits(
  userId: string,
  amount: number
): Promise<number> {
  const [result] = await db
    .update(users)
    .set({
      credits_balance: sql`${users.credits_balance} + ${amount}`,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ credits_balance: users.credits_balance });

  if (!result) {
    throw new Error('User not found');
  }

  return result.credits_balance;
}

/**
 * Get user's current credit balance
 */
export async function getCreditBalance(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { credits_balance: true },
  });

  return user?.credits_balance ?? 0;
}
