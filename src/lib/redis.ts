// lib/redis.ts
import { Redis } from '@upstash/redis';

// Define a type for your feed items to replace 'any[]'
// Adjust this interface to match the actual structure of your feed data
export interface FeedItem {
  id: string;
  // Add other properties that a feed item has, e.g.:
  // title: string;
  // content: string;
  // timestamp: number;
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper functions for common operations
// Use the specific type 'FeedItem[]' instead of 'any[]'
export async function cacheUserFeed(userId: string, feed: FeedItem[]) {
  await redis.set(`feed:${userId}`, JSON.stringify(feed), { ex: 1800 }); // 30min TTL
}

// Specify that the function returns a Promise resolving to FeedItem[] or null
export async function getCachedFeed(userId: string): Promise<FeedItem[] | null> {
  // We expect the result of redis.get to be a string or null
  const cached = await redis.get<string | null>(`feed:${userId}`);
  
  if (!cached) {
    return null;
  }
  
  // Explicitly cast the parsed JSON to the expected type
  return JSON.parse(cached) as FeedItem[];
}
