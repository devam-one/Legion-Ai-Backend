// app/api/feed/user/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts, users, ai_generations, likes } from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  try {
    // Get authenticated user (optional)
    const { userId: currentUserId } = await auth();

    // Parse query params
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'user_id required' },
        { status: 400 }
      );
    }

    // Determine visibility filter
    // If viewing own profile, show all posts
    // If viewing others, show only public posts
    const visibilityCondition = currentUserId === targetUserId
      ? undefined
      : eq(posts.visibility, 'public');

    // Fetch user's posts
    const userPosts = await db
      .select({
        id: posts.id,
        caption: posts.caption,
        visibility: posts.visibility,
        created_at: posts.created_at,
        user: {
          id: users.id,
          username: users.username,
          avatar_url: users.avatar_url,
        },
        content: {
          id: ai_generations.id,
          prompt: ai_generations.prompt,
          generation_type: ai_generations.generation_type,
          result_url: ai_generations.result_url,
          thumbnail_url: ai_generations.thumbnail_url,
        },
        liked_by_me: currentUserId ? sql<boolean>`EXISTS(
          SELECT 1 FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id} 
          AND ${likes.user_id} = ${currentUserId}
        )` : sql<boolean>`false`,
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id}
        )`,
      })
      .from(posts)
      .innerJoin(users, eq(posts.user_id, users.id))
      .leftJoin(ai_generations, eq(posts.content_id, ai_generations.id))
      .where(
        visibilityCondition
          ? and(eq(posts.user_id, targetUserId), visibilityCondition)
          : eq(posts.user_id, targetUserId)
      )
      .orderBy(desc(posts.created_at))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(posts)
      .where(
        visibilityCondition
          ? and(eq(posts.user_id, targetUserId), visibilityCondition)
          : eq(posts.user_id, targetUserId)
      );

    return NextResponse.json({
      data: userPosts,
      pagination: {
        page,
        limit,
        total: count,
        hasMore: offset + limit < count,
      },
    });

  } catch (error) {
    console.error('User feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
