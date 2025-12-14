// app/api/auth/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis';

// Clerk webhook event type
type ClerkWebhookEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    username: string | null;
    image_url: string | null;
    first_name: string | null;
    last_name: string | null;
  };
};

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If no signature headers, reject
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);

  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Check if already processed (Idempotency)
  const cached = await redis.get(`webhook:processed:${svix_id}`);
  if (cached) {
    return NextResponse.json({ success: true, cached: true });
  }

  // Handle the event
  const { type, data } = evt;

  try {
    switch (type) {
      case 'user.created':
        // Create user in Neon
        await db.insert(users).values({
          id: data.id,
          email: data.email_addresses[0].email_address,
          username: data.username || `user_${data.id.slice(0, 8)}`,
          avatar_url: data.image_url,
          bio: null,
          credits_balance: 100, // Welcome bonus
          is_premium: false,
        });
        console.log(`✅ User created: ${data.id}`);
        break;

      case 'user.updated':
        // Update user in Neon
        await db
          .update(users)
          .set({
            email: data.email_addresses[0].email_address,
            username: data.username || undefined,
            avatar_url: data.image_url || undefined,
            updated_at: new Date(),
          })
          .where(eq(users.id, data.id));
        console.log(`✅ User updated: ${data.id}`);
        break;

      case 'user.deleted':
        // Delete user from Neon (cascade will handle related data)
        await db.delete(users).where(eq(users.id, data.id));
        console.log(`✅ User deleted: ${data.id}`);
        break;
    }

    // Mark as processed (24hr TTL)
    await redis.set(`webhook:processed:${svix_id}`, '1', { ex: 86400 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Database operation failed' },
      { status: 500 }
    );
  }
}
