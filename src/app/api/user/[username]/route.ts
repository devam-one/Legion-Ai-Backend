// app/api/user/[username]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, posts, follows, ai_generations } from '@/db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  req: Request,
  props: { params: Promise<{ username: string }> }
) {
  const params = await props.params;

  try {
    // Get current user (optional - may be viewing anonymously)
    const { userId: currentUserId } = await auth();

    // 1. Find user by username
    const targetUser = await db.query.users.findFirst({
      where: eq(users.username, params.username),
      columns: {
        id: true,
        username: true,
        avatar_url: true,
        bio: true,
        created_at: true,
        // Don't expose email or credits to others
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 2. Get user stats
    const [{ postCount }] = await db
      .select({ postCount: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        and(
          eq(posts.user_id, targetUser.id),
          eq(posts.visibility, 'public')
        )
      );

    const [{ followerCount }] = await db
      .select({ followerCount: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.following_id, targetUser.id));

    const [{ followingCount }] = await db
      .select({ followingCount: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.follower_id, targetUser.id));

    // 3. Check if current user follows this user
    let isFollowing = false;
    let isOwnProfile = false;

    if (currentUserId) {
      isOwnProfile = currentUserId === targetUser.id;

      if (!isOwnProfile) {
        const followRelation = await db.query.follows.findFirst({
          where: and(
            eq(follows.follower_id, currentUserId),
            eq(follows.following_id, targetUser.id)
          ),
        });
        isFollowing = !!followRelation;
      }
    }

    // 4. Get recent public posts (limited to 6 for profile preview)
    const recentPosts = await db
      .select({
        id: posts.id,
        caption: posts.caption,
        created_at: posts.created_at,
        content: {
          id: ai_generations.id,
          generation_type: ai_generations.generation_type,
          result_url: ai_generations.result_url,
          thumbnail_url: ai_generations.thumbnail_url,
        },
        like_count: sql<number>`(
          SELECT COUNT(*)::int FROM likes 
          WHERE likes.post_id = ${posts.id}
        )`,
      })
      .from(posts)
      .leftJoin(ai_generations, eq(posts.content_id, ai_generations.id))
      .where(
        and(
          eq(posts.user_id, targetUser.id),
          eq(posts.visibility, 'public')
        )
      )
      .orderBy(desc(posts.created_at))
      .limit(6);

    // 5. Return profile data
    return NextResponse.json({
      user: {
        id: targetUser.id,
        username: targetUser.username,
        avatar_url: targetUser.avatar_url,
        bio: targetUser.bio,
        created_at: targetUser.created_at,
      },
      stats: {
        posts: postCount,
        followers: followerCount,
        following: followingCount,
      },
      relationship: {
        isOwnProfile,
        isFollowing,
      },
      recentPosts,
    });

  } catch (error) {
    console.error('User profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
