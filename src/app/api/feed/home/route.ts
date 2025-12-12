// app/api/feed/home/route.ts (UPDATE with caching)
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts, follows, users, ai_generations, likes } from '@/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { getCachedHomeFeed, cacheHomeFeed } from '@/lib/utils/feed';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Try to get from cache (only for first page)
    if (page === 1) {
      const cached = await getCachedHomeFeed(userId);
      if (cached) {
        return NextResponse.json({
          data: cached.slice(0, limit),
          pagination: {
            page,
            limit,
            total: cached.length,
            hasMore: cached.length > limit,
          },
          cached: true,
        });
      }
    }

    // Get following list
    const followingList = await db
      .select({ following_id: follows.following_id })
      .from(follows)
      .where(eq(follows.follower_id, userId));

    const followingIds = followingList.map(f => f.following_id);

    if (followingIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      });
    }

    // Fetch fresh feed from database
    const feedPosts = await db
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
        liked_by_me: sql<boolean>`EXISTS(
          SELECT 1 FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id} 
          AND ${likes.user_id} = ${userId}
        )`,
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM ${likes} 
          WHERE ${likes.post_id} = ${posts.id}
        )`,
      })
      .from(posts)
      .innerJoin(users, eq(posts.user_id, users.id))
      .leftJoin(ai_generations, eq(posts.content_id, ai_generations.id))
      .where(inArray(posts.user_id, followingIds))
      .orderBy(desc(posts.created_at))
      .limit(50); // Fetch more for caching

    // Cache the first 50 posts
    if (page === 1 && feedPosts.length > 0) {
      await cacheHomeFeed(userId, feedPosts);
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(posts)
      .where(inArray(posts.user_id, followingIds));

    return NextResponse.json({
      data: feedPosts.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total: count,
        hasMore: offset + limit < count,
      },
      cached: false,
    });

  } catch (error) {
    console.error('Home feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
