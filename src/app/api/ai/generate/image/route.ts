// app/api/ai/generate/image/route.ts (UPDATED with AI SDK)
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ai_generations } from '@/db/schema';
import { generateImageSchema } from '@/lib/validations/ai';
import { CREDIT_COSTS, deductCredits, hasEnoughCredits, getCreditBalance } from '@/lib/utils/credits';
import { generateAIImage } from '@/lib/ai/providers';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

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

    // 2. Parse and validate input
    const body = await req.json();
    const validatedInput = generateImageSchema.parse(body);

    // 3. Check if user has enough credits
    const requiredCredits = CREDIT_COSTS.image;
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

    // 4. Deduct credits (atomic)
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
        generation_type: 'image',
        credits_cost: requiredCredits,
        status: 'processing',
        is_public: true,
      })
      .returning();

    // 6. Generate image with Vercel AI SDK (supports multiple providers)
    const result = await generateAIImage(validatedInput.prompt, 'openai');

    if (!result.success) {
      // Mark as failed
      await db.update(ai_generations)
        .set({ status: 'failed' })
        .where(eq(ai_generations.id, generation.id));

      // Refund credits
      await sql`
        UPDATE users 
        SET credits_balance = credits_balance + ${requiredCredits}
        WHERE id = ${userId}
      `;

      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      );
    }

    // 7. Update with result
    const [updatedGeneration] = await db.update(ai_generations)
      .set({
        result_url: result.url,
        thumbnail_url: result.url,
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
        result_url: updatedGeneration.result_url,
        credits_cost: updatedGeneration.credits_cost,
        created_at: updatedGeneration.created_at,
      },
      credits_remaining: await getCreditBalance(userId),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
