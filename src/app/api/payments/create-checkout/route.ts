// app/api/payments/create-checkout/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCreditPackage, type CreditPackageId } from '@/lib/utils/credits';
import { z } from 'zod';

// Input validation
const checkoutSchema = z.object({
  package_id: z.enum(['10', '50', '5']), // Updated to match keys
});

// Your WordPress/WooCommerce site URL
const WORDPRESS_URL = process.env.WORDPRESS_URL || 'https://legion.yoursite.com';

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
    const validatedInput = checkoutSchema.parse(body);
    const packageId = parseInt(validatedInput.package_id) as CreditPackageId;

    // 3. Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 4. Get credit package
    const creditPackage = getCreditPackage(packageId);

    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid package' },
        { status: 400 }
      );
    }

    // 5. Generate WooCommerce checkout URL
    // This assumes you have products in WooCommerce with specific IDs
    const productIdMap: Record<number, number> = {
      10: 100, // Replace with your actual WooCommerce product IDs
      50: 101,
      5: 102,
    };

    const productId = productIdMap[packageId];


    // Build checkout URL with pre-filled customer data
    const checkoutUrl = new URL(`${WORDPRESS_URL}/checkout/`);
    checkoutUrl.searchParams.set('add-to-cart', productId.toString());
    checkoutUrl.searchParams.set('billing_email', user.email);
    checkoutUrl.searchParams.set('billing_first_name', user.username);

    // Add custom parameter to track user
    checkoutUrl.searchParams.set('legion_user_id', userId);

    // 6. Return checkout URL
    return NextResponse.json({
      checkout_url: checkoutUrl.toString(),
      package: {
        id: packageId,
        credits: creditPackage.credits,
        bonus: creditPackage.bonus || 0,
        total_credits: creditPackage.credits + (creditPackage.bonus || 0),
        price: creditPackage.price_inr,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }


    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
