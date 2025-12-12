// app/api/status/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { sql } from 'drizzle-orm';

export async function GET() {
    const checks = {
        database: false,
        redis: false,
        timestamp: new Date().toISOString(),
    };

    // Check database
    try {
        await db.execute(sql`SELECT 1`);
        checks.database = true;
    } catch (error) {
        console.error('DB check failed:', error);
    }

    // Check Redis
    try {
        await redis.ping();
        checks.redis = true;
    } catch (error) {
        console.error('Redis check failed:', error);
    }

    const allHealthy = checks.database && checks.redis;

    return NextResponse.json(
        {
            status: allHealthy ? 'healthy' : 'degraded',
            checks,
            version: '1.0.0',
        },
        { status: allHealthy ? 200 : 503 }
    );
}
