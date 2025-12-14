// app/api/ai/generate/text/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ai_generations } from '@/db/schema';
import { CREDIT_COSTS, deductCredits, hasEnoughCredits, getCreditBalance } from '@/lib/utils/credits';
import { generateAIText } from '@/lib/ai/providers';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';

// Input validation
const generateTextSchema = z.object({
  prompt: z.string()
    .min(3, 'Prompt must be at least 3 characters')
    .max(2000, 'Prompt is too long'),
  provider: z.enum(['openai', 'gemini', 'gptMini']).default('gemini'), // Gemini is cheaper
});

export async function POST(req: Request) {
  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Validate input
    const body = await req.json();
    const validatedInput = generateTextSchema.parse(body);

    // 3. Check credits
    const requiredCredits = CREDIT_COSTS.text;
    const hasCredits = await hasEnoughCredits(userId, requiredCredits);

    if (!hasCredits) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          required: requiredCredits,
        },
        { status: 402 }
      );
    }

    // 4. Deduct credits
    try {
      await deductCredits(userId, requiredCredits);
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to deduct credits' },
        { status: 500 }
      );
    }

    // 5. Create generation record
    const [generation] = await db.insert(ai_generations)
      .values({
        user_id: userId,
        prompt: validatedInput.prompt,
        generation_type: 'text',
        credits_cost: requiredCredits,
        status: 'processing',
        is_public: true,
      })
      .returning();

    // 6. Generate text with Vercel AI SDK
    const result = await generateAIText(
      validatedInput.prompt,
      validatedInput.provider
    );

    if (!result.success) {
      // Mark as failed and refund
      await db.update(ai_generations)
        .set({ status: 'failed' })
        .where(eq(ai_generations.id, generation.id));

      await db.execute(sql`
        UPDATE users 
        SET credits_balance = credits_balance + ${requiredCredits}
        WHERE id = ${userId}
      `);

      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      );
    }

    // 7. Store text result (we'll store it in result_url as plain text for now)
    const [updatedGeneration] = await db.update(ai_generations)
      .set({
        result_url: result.text, // Store text directly
        status: 'completed',
      })
      .where(eq(ai_generations.id, generation.id))
      .returning();

    // 8. Return success
    return NextResponse.json({
      success: true,
      generation: {
        id: updatedGeneration.id,
        prompt: updatedGeneration.prompt,
        text: updatedGeneration.result_url, // The generated text
        credits_cost: updatedGeneration.credits_cost,
        created_at: updatedGeneration.created_at,
      },
      credits_remaining: await getCreditBalance(userId),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    Sentry.captureException(error);
    console.error('Text generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
