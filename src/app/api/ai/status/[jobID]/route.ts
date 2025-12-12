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
// Delete generation route
export async function DELETE(
  req: Request,
  { params }: { params: { jobId: string } }
) 
{
  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Delete generation (only if owned by user)
    const [deletedGeneration] = await db
      .delete(ai_generations)
      .where(
        and(
          eq(ai_generations.id, params.jobId),
          eq(ai_generations.user_id, userId)
        )
      )
      .returning();

    if (!deletedGeneration) {
      return NextResponse.json(
        { error: 'Generation not found or unauthorized' },
        { status: 404 }
      );
    }

    // 3. Return success
    return NextResponse.json({
      success: true,
      message: 'Generation deleted successfully',
      deleted_id: deletedGeneration.id,
    });

  } catch (error) {
    console.error('Generation delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
// app/api/ai/status/[jobId]/route.ts (ADD PATCH method)

export async function PATCH(
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

    // 2. Parse request body
    const body = await req.json();
    const { is_public } = body;

    // Validate input
    if (typeof is_public !== 'boolean') {
      return NextResponse.json(
        { error: 'is_public must be a boolean' },
        { status: 400 }
      );
    }

    // 3. Update visibility (only if owned by user)
    const [updatedGeneration] = await db
      .update(ai_generations)
      .set({ 
        is_public,
        // Note: We don't update updated_at here since it's not a profile change
      })
      .where(
        and(
          eq(ai_generations.id, params.jobId),
          eq(ai_generations.user_id, userId)
        )
      )
      .returning();

    if (!updatedGeneration) {
      return NextResponse.json(
        { error: 'Generation not found or unauthorized' },
        { status: 404 }
      );
    }

    // 4. Return updated generation
    return NextResponse.json({
      success: true,
      generation: {
        id: updatedGeneration.id,
        is_public: updatedGeneration.is_public,
      },
    });

  } catch (error) {
    console.error('Generation update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
