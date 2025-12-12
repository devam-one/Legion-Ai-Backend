// app/api/payments/packages/route.ts
import { NextResponse } from 'next/server';
import { CREDIT_COSTS } from '@/lib/utils/credits';

export async function GET() {
  // Convert packages object to array
  const packages = Object.values(CREDIT_COSTS).map(pkg => ({
    id: pkg.id,
    credits: pkg.credits,
    bonus: pkg.bonus || 0,
    total_credits: pkg.credits + (pkg.bonus || 0),
    price_inr: pkg.price_inr,
    price_usd: pkg.price_usd,
    popular: pkg.popular || false,
    // Calculate value (credits per rupee)
    value: ((pkg.credits + (pkg.bonus || 0)) / pkg.price_inr).toFixed(2),
  }));

  return NextResponse.json({
    packages,
    currency: 'INR',
  });
}
