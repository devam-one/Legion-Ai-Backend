// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// Different limits for different endpoints
export const aiGenerationLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 requests per hour
  analytics: true,
});

export const apiLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '15 m'), // 100 requests per 15min
  analytics: true,
});

export const authLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 auth attempts per 15min
  analytics: true,
});
