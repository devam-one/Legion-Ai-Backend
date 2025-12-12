// app/api/feed/explore/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts, users, ai_generations, likes } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  try {
    // Get authenticated user ID (optional for explore)
    const { userId } = await auth();

    // Parse pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sort') || 'recent'; // 'recent' or 'popular'
    const offset = (page - 1) * limit;

    // Build base query
    const baseQuery = db
      .select({
        // Post data
        id: posts.id,
        caption: posts.caption,
        visibility: posts.visibility,
        created_at: posts.created_at,
        // User data
        user: {
          id: users.id,
          username: users.username,
          avatar_url: users.avatar_url,
        },
        // AI generation data
        content: {
          id: ai_generations.id,
          prompt: ai_generations.prompt,
          generation_type: ai_generations.generation_type,
          result_url: ai_generations.result_url,
          thumbnail_url: ai_generations.thumbnail_url,
        },
        // Like status (if authenticated)
        liked_by_me: userId ? sql<boolean>`EXISTS(
          SELECT 1 FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id} 
          AND ${likes.user_id} = ${userId}
        )` : sql<boolean>`false`,
        // Like count
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id}
        )`,
      })
      .from(posts)
      .innerJoin(users, eq(posts.user_id, users.id))
      .leftJoin(ai_generations, eq(posts.content_id, ai_generations.id))
      .where(eq(posts.visibility, 'public')) // Only public posts
      .$dynamic();

    // Apply sorting
    if (sortBy === 'popular') {
      // Sort by like count (trending)
      baseQuery.orderBy(
        desc(sql`(SELECT COUNT(*) FROM ${likes} WHERE ${likes.post_id} = ${posts.id})`),
        desc(posts.created_at)
      );
    } else {
      // Sort by recent
      baseQuery.orderBy(desc(posts.created_at));
    }

    // Apply pagination
    const explorePosts = await baseQuery
      .limit(limit)
      .offset(offset);

    // Get total count of public posts
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.visibility, 'public'));


    return NextResponse.json({
      data: explorePosts,
      pagination: {
        page,
        limit,
        total: count,
        hasMore: offset + limit < count,
      },
    });

  } catch (error) {
    console.error('Explore feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
