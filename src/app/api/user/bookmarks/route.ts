// app/api/user/bookmarks/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookmarks, posts, users, ai_generations, likes } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

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

    // 2. Parse pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 3. Fetch bookmarked posts
    const bookmarkedPosts = await db
      .select({
        // Bookmark data
        bookmark_id: bookmarks.id,
        bookmarked_at: bookmarks.created_at,
        // Post data
        post: {
          id: posts.id,
          caption: posts.caption,
          visibility: posts.visibility,
          created_at: posts.created_at,
        },
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
        // Like status
        liked_by_me: sql<boolean>`EXISTS(
          SELECT 1 FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id} 
          AND ${likes.user_id} = ${userId}
        )`,
        // Like count
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id}
        )`,
      })
      .from(bookmarks)
      .innerJoin(posts, eq(bookmarks.post_id, posts.id))
      .innerJoin(users, eq(posts.user_id, users.id))
      .leftJoin(ai_generations, eq(posts.content_id, ai_generations.id))
      .where(eq(bookmarks.user_id, userId))
      .orderBy(desc(bookmarks.created_at))
      .limit(limit)
      .offset(offset);

    // 4. Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookmarks)
      .where(eq(bookmarks.user_id, userId));


    return NextResponse.json({
      data: bookmarkedPosts,
      pagination: {
        page,
        limit,
        total: count,
        hasMore: offset + limit < count,
      },
    });

  } catch (error) {
    console.error('Bookmarks fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
