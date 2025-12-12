// lib/db.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from './env';
import * as schema from '@/db/schema';
// Create SQL connection
const sql = neon(env.DATABASE_URL);

// Pass schema to drizzle
export const db = drizzle(sql, { schema });

export async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as time`;
    return { success: true, serverTime: result[0].time };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
