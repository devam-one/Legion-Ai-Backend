// lib/utils/feed-cache.ts
import { redis } from '@/lib/redis';

// TODO: Replace 'unknown' with proper FeedItem type from schema or shared types
type FeedItem = unknown;

const CACHE_TTL = {
  HOME_FEED: 5 * 60, // 5 minutes
  EXPLORE_FEED: 10 * 60, // 10 minutes
  USER_FEED: 15 * 60, // 15 minutes
};

/**
 * Cache home feed for a user
 */
export async function cacheHomeFeed(userId: string, feed: FeedItem[]) {
  const key = `feed:home:${userId}`;
  await redis.setex(key, CACHE_TTL.HOME_FEED, JSON.stringify(feed));
}

/**
 * Get cached home feed
 */
export async function getCachedHomeFeed(userId: string): Promise<FeedItem[] | null> {
  const key = `feed:home:${userId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached as string) : null;
}

/**
 * Cache explore feed (shared across all users)
 */
export async function cacheExploreFeed(feed: FeedItem[], sortBy: string = 'recent') {
  const key = `feed:explore:${sortBy}`;
  await redis.setex(key, CACHE_TTL.EXPLORE_FEED, JSON.stringify(feed));
}

/**
 * Get cached explore feed
 */
export async function getCachedExploreFeed(sortBy: string = 'recent'): Promise<FeedItem[] | null> {
  const key = `feed:explore:${sortBy}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached as string) : null;
}

/**
 * Cache user profile feed
 */
export async function cacheUserFeed(targetUserId: string, feed: FeedItem[]) {
  const key = `feed:user:${targetUserId}`;
  await redis.setex(key, CACHE_TTL.USER_FEED, JSON.stringify(feed));
}

/**
 * Get cached user feed
 */
export async function getCachedUserFeed(targetUserId: string): Promise<FeedItem[] | null> {
  const key = `feed:user:${targetUserId}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached as string) : null;
}

/**
 * Invalidate user's home feed cache (when they post/like/follow)
 */
export async function invalidateHomeFeed(userId: string) {
  const key = `feed:home:${userId}`;
  await redis.del(key);
}

/**
 * Invalidate explore feed cache (when new post is created)
 */
export async function invalidateExploreFeed() {
  await redis.del('feed:explore:recent', 'feed:explore:popular');
}

/**
 * Invalidate user feed cache
 */
export async function invalidateUserFeed(userId: string) {
  const key = `feed:user:${userId}`;
  await redis.del(key);
}
