// lib/utils/optimistic-queue.ts
import { redis } from '@/lib/redis';

/**
 * Add like action to queue
 */
export async function queueLike(userId: string, postId: string) {
  await redis.lpush('queue:likes', JSON.stringify({
    user_id: userId,
    post_id: postId,
    action: 'like',
    timestamp: Date.now(),
  }));
}

/**
 * Add unlike action to queue
 */
export async function queueUnlike(userId: string, postId: string) {
  await redis.lpush('queue:likes', JSON.stringify({
    user_id: userId,
    post_id: postId,
    action: 'unlike',
    timestamp: Date.now(),
  }));
}

/**
 * Process like queue (call this from a cron job or background worker)
 */
export async function processLikeQueue() {
  const batchSize = 100;
  const items = await redis.rpop('queue:likes', batchSize);
  
  if (!items || items.length === 0) return 0;

  // Process each item
  let processed = 0;
  for (const item of items) {
    try {
      const action = JSON.parse(item as string);
      
      if (action.action === 'like') {
        // Insert into database
        await db.insert(likes).values({
          user_id: action.user_id,
          post_id: action.post_id,
        }).onConflictDoNothing();
      } else {
        // Delete from database
        await db.delete(likes).where(
          and(
            eq(likes.user_id, action.user_id),
            eq(likes.post_id, action.post_id)
          )
        );
      }
      
      processed++;
    } catch (error) {
      console.error('Queue processing error:', error);
    }
  }

  return processed;
}
