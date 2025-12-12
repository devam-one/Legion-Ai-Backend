// app/api/ai/status/[jobId]/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ai_generations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Fetch generation by ID and ensure it belongs to the user
    const generation = await db.query.ai_generations.findFirst({
      where: and(
        eq(ai_generations.id, params.jobId),
        eq(ai_generations.user_id, userId)
      ),
    });

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    // 3. Return generation details
    return NextResponse.json({
      id: generation.id,
      prompt: generation.prompt,
      generation_type: generation.generation_type,
      result_url: generation.result_url,
      thumbnail_url: generation.thumbnail_url,
      credits_cost: generation.credits_cost,
      status: generation.status,
      is_public: generation.is_public,
      created_at: generation.created_at,
    });

  } catch (error) {
    console.error('Generation fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
