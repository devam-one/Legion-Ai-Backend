// app/api/posts/create/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { posts, ai_generations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Input validation
const createPostSchema = z.object({
  content_id: z.string().uuid(), // AI generation ID
  caption: z.string().max(500, 'Caption too long').optional(),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

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
    const validatedInput = createPostSchema.parse(body);

    // 3. Verify the AI generation exists and belongs to user
    const generation = await db.query.ai_generations.findFirst({
      where: and(
        eq(ai_generations.id, validatedInput.content_id),
        eq(ai_generations.user_id, userId)
      ),
    });

    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if generation is completed
    if (generation.status !== 'completed') {
      return NextResponse.json(
        { error: 'Cannot post incomplete generation' },
        { status: 400 }
      );
    }

    // 4. Create post
    const [post] = await db.insert(posts)
      .values({
        user_id: userId,
        content_id: validatedInput.content_id,
        caption: validatedInput.caption || null,
        visibility: validatedInput.visibility,
      })
      .returning();

    // 5. Fetch post with generation details for response
    const postWithDetails = await db.query.posts.findFirst({
      where: eq(posts.id, post.id),
      with: {
        content: true, // Includes AI generation data
        user: {
          columns: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    // 6. Return created post
    return NextResponse.json({
      success: true,
      post: postWithDetails,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Post creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
