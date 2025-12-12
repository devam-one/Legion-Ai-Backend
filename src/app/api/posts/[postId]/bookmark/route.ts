// app/api/posts/[postId]/bookmark/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bookmarks, posts } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// POST - Bookmark a post
export async function POST(
  req: Request,
  props: { params: Promise<{ postId: string }> }
) {
  const params = await props.params;

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

    // 3. Check if already bookmarked
    const existingBookmark = await db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.post_id, params.postId),
        eq(bookmarks.user_id, userId)
      ),
    });

    if (existingBookmark) {
      return NextResponse.json(
        { error: 'Already bookmarked' },
        { status: 409 }
      );
    }

    // 4. Create bookmark
    const [bookmark] = await db.insert(bookmarks)
      .values({
        post_id: params.postId,
        user_id: userId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      bookmarked: true,
      bookmark_id: bookmark.id,
    });

  } catch (error) {
    console.error('Bookmark error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove bookmark
export async function DELETE(
  req: Request,
  props: { params: Promise<{ postId: string }> }
) {
  const params = await props.params;

  try {
    // 1. Authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Delete bookmark
    const [deletedBookmark] = await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.post_id, params.postId),
          eq(bookmarks.user_id, userId)
        )
      )
      .returning();

    if (!deletedBookmark) {
      return NextResponse.json(
        { error: 'Bookmark not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      bookmarked: false,
    });

  } catch (error) {
    console.error('Unbookmark error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
