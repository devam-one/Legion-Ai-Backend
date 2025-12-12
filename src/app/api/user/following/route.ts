// app/api/user/following/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { follows, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

// Input validation
const followSchema = z.object({
  following_id: z.string().min(1, 'User ID required'),
});

// POST - Follow a user
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
    const validatedInput = followSchema.parse(body);

    // 3. Check if trying to follow self
    if (userId === validatedInput.following_id) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // 4. Verify target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, validatedInput.following_id),
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 5. Check if already following
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(follows.follower_id, userId),
        eq(follows.following_id, validatedInput.following_id)
      ),
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: 'Already following this user' },
        { status: 409 }
      );
    }

    // 6. Create follow relationship
    const [follow] = await db.insert(follows)
      .values({
        follower_id: userId,
        following_id: validatedInput.following_id,
      })
      .returning();

    return NextResponse.json({
      success: true,
      following: true,
      follow_id: follow.id,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Follow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Unfollow a user
export async function DELETE(req: Request) {
  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get following_id from query params
    const { searchParams } = new URL(req.url);
    const following_id = searchParams.get('following_id');

    if (!following_id) {
      return NextResponse.json(
        { error: 'following_id required' },
        { status: 400 }
      );
    }

    // 3. Delete follow relationship
    const [deletedFollow] = await db
      .delete(follows)
      .where(
        and(
          eq(follows.follower_id, userId),
          eq(follows.following_id, following_id)
        )
      )
      .returning();

    if (!deletedFollow) {
      return NextResponse.json(
        { error: 'Follow relationship not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      following: false,
    });

  } catch (error) {
    console.error('Unfollow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get following/followers list
export async function GET(req: Request) {
  try {
    // Get user ID from query params (to view someone else's follows)
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('user_id');
    const type = searchParams.get('type') || 'following'; // 'following' or 'followers'

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'user_id required' },
        { status: 400 }
      );
    }

    if (type === 'following') {
      // Get users that targetUserId follows
      const following = await db
        .select({
          id: users.id,
          username: users.username,
          avatar_url: users.avatar_url,
          bio: users.bio,
        })
        .from(follows)
        .innerJoin(users, eq(follows.following_id, users.id))
        .where(eq(follows.follower_id, targetUserId));

      return NextResponse.json({
        data: following,
        count: following.length,
      });
    } else {
      // Get users that follow targetUserId
      const followers = await db
        .select({
          id: users.id,
          username: users.username,
          avatar_url: users.avatar_url,
          bio: users.bio,
        })
        .from(follows)
        .innerJoin(users, eq(follows.follower_id, users.id))
        .where(eq(follows.following_id, targetUserId));

      return NextResponse.json({
        data: followers,
        count: followers.length,
      });
    }

  } catch (error) {
    console.error('Follows fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
