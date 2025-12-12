// lib/utils/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';

// API rate limits per endpoint
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
  prefix: 'ratelimit:api',
});

// AI generation rate limit (stricter)
export const aiGenerationLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 generations per hour
  analytics: true,
  prefix: 'ratelimit:ai',
});

// Auth endpoints (very strict)
export const authLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
  analytics: true,
  prefix: 'ratelimit:auth',
});

// Like/comment actions (moderate)
export const interactionLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 interactions per minute
  analytics: true,
  prefix: 'ratelimit:interaction',
});
