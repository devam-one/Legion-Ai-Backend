// app/api/ai/history/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ai_generations, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET(req: Request) {
  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse pagination parameters from URL
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // 'completed', 'processing', 'failed'
    const type = searchParams.get('type'); // 'image', 'video', 'text'

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // 3. Build query with filters
    let query = db
      .select({
        id: ai_generations.id,
        prompt: ai_generations.prompt,
        generation_type: ai_generations.generation_type,
        result_url: ai_generations.result_url,
        thumbnail_url: ai_generations.thumbnail_url,
        credits_cost: ai_generations.credits_cost,
        status: ai_generations.status,
        is_public: ai_generations.is_public,
        created_at: ai_generations.created_at,
      })
      .from(ai_generations)
      .where(eq(ai_generations.user_id, userId));

    // Apply filters if provided
    if (status) {
      query = query.where(eq(ai_generations.status, status));
    }
    if (type) {
      query = query.where(eq(ai_generations.generation_type, type));
    }

    // 4. Fetch generations with pagination
    const generations = await query
      .orderBy(desc(ai_generations.created_at))
      .limit(limit)
      .offset(offset);

    // 5. Get total count for pagination metadata
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(ai_generations)
      .where(eq(ai_generations.user_id, userId));

    const totalPages = Math.ceil(count / limit);

    // 6. Return paginated response
    return NextResponse.json({
      data: generations,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasMore: page < totalPages,
      },
    });

  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
