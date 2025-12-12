// app/api/payments/woo/webhook/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addCredits } from '@/lib/utils/credits';
import { env } from '@/lib/env';
import crypto from 'crypto';

// WooCommerce Order payload structure
type WooCommerceOrder = {
  id: number;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  customer_id: number;
  billing: {
    email: string;
    first_name: string;
    last_name: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    meta_data: Array<{
      key: string;
      value: string;
    }>;
  }>;
  total: string;
  currency: string;
  date_paid: string | null;
};

export async function POST(req: Request) {
  try {
    // 1. Get webhook signature
    const signature = req.headers.get('x-wc-webhook-signature');
    const body = await req.text();

    // 2. Verify webhook signature (CRITICAL for security)
    if (!verifyWooCommerceSignature(body, signature)) {
      console.error('Invalid WooCommerce webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. Parse order data
    const order: WooCommerceOrder = JSON.parse(body);

    // 4. Only process completed orders
    if (order.status !== 'completed') {
      return NextResponse.json({
        message: 'Order not completed yet',
        status: order.status,
      });
    }

    // 5. Extract credit package info from line items
    const creditItem = order.line_items.find(item => 
      item.name.toLowerCase().includes('credits') ||
      item.meta_data.some(meta => meta.key === '_legion_credits')
    );

    if (!creditItem) {
      return NextResponse.json(
        { error: 'No credit package found in order' },
        { status: 400 }
      );
    }

    // 6. Get credit amount from meta data
    const creditsMeta = creditItem.meta_data.find(
      meta => meta.key === '_legion_credits'
    );
    const creditsToAdd = creditsMeta 
      ? parseInt(creditsMeta.value) 
      : parseInt(creditItem.name.match(/\d+/)?.[0] || '0');

    if (!creditsToAdd || creditsToAdd <= 0) {
      return NextResponse.json(
        { error: 'Invalid credit amount' },
        { status: 400 }
      );
    }

    // 7. Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, order.billing.email),
    });

    if (!user) {
      console.error('User not found:', order.billing.email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 8. Add credits to user account
    const newBalance = await addCredits(user.id, creditsToAdd);

    console.log(`✅ Credits added: ${creditsToAdd} for user ${user.email} (Order #${order.id})`);

    // 9. Return success
    return NextResponse.json({
      success: true,
      user_id: user.id,
      credits_added: creditsToAdd,
      new_balance: newBalance,
      order_id: order.id,
    });

  } catch (error) {
    console.error('WooCommerce webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify WooCommerce webhook signature
 */
function verifyWooCommerceSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', env.WOOCOMMERCE_WEBHOOK_SECRET)
    .update(payload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
