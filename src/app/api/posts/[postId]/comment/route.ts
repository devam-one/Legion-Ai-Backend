// app/api/posts/[postId]/comment/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comments, posts } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

// Input validation
const commentSchema = z.object({
  text: z.string()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment too long'),
});

// GET - Fetch comments
export async function GET(
  req: Request,
  props: { params: Promise<{ postId: string }> }
) {
  const params = await props.params;

  try {
    // No auth required - public comments (adjust if needed)

    // Parse pagination
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 1. Verify post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, params.postId),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // 2. Fetch comments with user info
    const postComments = await db.query.comments.findMany({
      where: eq(comments.post_id, params.postId),
      orderBy: [desc(comments.created_at)],
      limit,
      offset,
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    // 3. Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.post_id, params.postId));


    return NextResponse.json({
      data: postComments,
      pagination: {
        page,
        limit,
        total: count,
        hasMore: offset + limit < count,
      },
    });

  } catch (error) {
    console.error('Comments fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create comment
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

    // 2. Validate input
    const body = await req.json();
    const validatedInput = commentSchema.parse(body);

    // 3. Verify post exists
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, params.postId),
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // 4. Create comment
    const [comment] = await db.insert(comments)
      .values({
        post_id: params.postId,
        user_id: userId,
        content: validatedInput.text,
      })
      .returning();


    // 5. Fetch comment with user info
    const commentWithUser = await db.query.comments.findFirst({
      where: eq(comments.id, comment.id),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      comment: commentWithUser,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Comment creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
