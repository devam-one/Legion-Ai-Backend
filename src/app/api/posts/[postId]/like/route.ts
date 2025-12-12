// app/api/posts/[postId]/like/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { likes, posts } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(
  req: Request,
  { params }: { params: { postId: string } }
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

    // 2. Verify post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, params.postId),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // 3. Check if already liked
    const existingLike = await db.query.likes.findFirst({
      where: and(
        eq(likes.post_id, params.postId),
        eq(likes.user_id, userId)
      ),
    });

    if (existingLike) {
      return NextResponse.json(
        { error: 'Already liked' },
        { status: 409 }
      );
    }

    // 4. Create like
    const [like] = await db.insert(likes)
      .values({
        post_id: params.postId,
        user_id: userId,
      })
      .returning();

    // 5. Get like count
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(likes)
      .where(eq(likes.post_id, params.postId));

    return NextResponse.json({
      success: true,
      liked: true,
      like_count: count,
    });

  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { postId: string } }
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

    // 2. Delete like
    const [deletedLike] = await db
      .delete(likes)
      .where(
        and(
          eq(likes.post_id, params.postId),
          eq(likes.user_id, userId)
        )
      )
      .returning();

    if (!deletedLike) {
      return NextResponse.json(
        { error: 'Like not found' },
        { status: 404 }
      );
    }

    // 3. Get updated like count
    const [{ count }] = await db
      .select({ count: sql`count(*)::int` })
      .from(likes)
      .where(eq(likes.post_id, params.postId));

    return NextResponse.json({
      success: true,
      liked: false,
      like_count: count,
    });

  } catch (error) {
    console.error('Unlike error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
