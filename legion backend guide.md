
# Legion AI Backend - AI Agent Review Guide

## Project Overview

**Project Name:** Legion AI Backend  
**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Neon Postgres, Upstash Redis, Clerk Auth, Vercel AI SDK  
**Purpose:** Backend API for a social AI content generation mobile app built with React Native Expo  
**Target Users:** 10,000+ users (Indian and International markets)  
**Deployment:** Vercel (Serverless)

---

## Architecture Overview

### High-Level Architecture
```

React Native Expo App (Mobile)
↓ (HTTPS/JWT)
Vercel Edge Middleware (Clerk Auth)
↓
Next.js API Routes (Serverless Functions)
↓
├─→ Neon Postgres (Primary Database)
├─→ Upstash Redis (Cache + Queue)
├─→ OpenAI/Gemini (AI Generation via Vercel AI SDK)
└─→ WordPress/WooCommerce (Payment Gateway)

```

### Design Principles
1. **Security First:** JWT validation, input sanitization, rate limiting
2. **Performance:** Redis caching, optimistic updates, pagination
3. **Scalability:** Serverless functions, connection pooling, atomic operations
4. **Developer Experience:** Type safety, modular structure, clear naming

---

## Project Structure

```

legion-backend/
├── src/
│   ├── app/
│   │   ├── api/                    \# All API endpoints
│   │   │   ├── ai/                 \# AI generation features
│   │   │   ├── auth/               \# Authentication webhooks
│   │   │   ├── feed/               \# Social feeds
│   │   │   ├── payments/           \# Payment integration
│   │   │   ├── posts/              \# Social posts (like/comment/bookmark)
│   │   │   ├── user/               \# User management
│   │   │   └── health/             \# Health check
│   │   ├── layout.tsx              \# Root layout (Clerk provider)
│   │   └── page.tsx                \# Optional status page
│   ├── db/
│   │   ├── schema.ts               \# Drizzle ORM schema (7 tables)
│   │   └── migrations/             \# SQL migrations
│   ├── lib/
│   │   ├── ai/
│   │   │   └── providers.ts        \# Vercel AI SDK integration
│   │   ├── utils/
│   │   │   ├── credits.ts          \# Credit operations
│   │   │   ├── ratelimit.ts        \# Rate limiting config
│   │   │   ├── feed-cache.ts       \# Redis feed caching
│   │   │   └── optimistic-queue.ts \# Background job queue
│   │   ├── validations/
│   │   │   └── ai.ts               \# Zod input schemas
│   │   ├── db.ts                   \# Neon client setup
│   │   ├── redis.ts                \# Upstash client setup
│   │   ├── env.ts                  \# Environment validation
│   │   └── storage.ts              \# Image utilities (placeholder)
│   └── middleware.ts               \# Clerk authentication middleware
├── .env.local                      \# Environment variables (GITIGNORED)
├── drizzle.config.ts               \# Database migration config
├── next.config.js                  \# Next.js configuration
├── package.json                    \# Dependencies
└── tsconfig.json                   \# TypeScript config

```

---

## Database Schema

### Tables Overview
```

-- Core Tables
users              \# Synced from Clerk (id, username, email, credits_balance, is_premium)
ai_generations     \# AI-generated content (prompt, result_url, status, credits_cost)
posts              \# Social posts (user_id, content_id, caption, visibility)

-- Social Interaction Tables
likes              \# Post likes (user_id, post_id) [UNIQUE constraint]
comments           \# Post comments (user_id, post_id, text)
follows            \# User relationships (follower_id, following_id) [UNIQUE constraint]
bookmarks          \# Saved posts (user_id, post_id) [UNIQUE constraint]

-- Enums
generation_type    \# 'image', 'video', 'text'
visibility         \# 'public', 'followers', 'private'

```

### Critical Relationships
- Users CASCADE DELETE → All related data (generations, posts, likes, etc.)
- Posts reference AI generations (content_id → ai_generations.id)
- Unique constraints prevent duplicate likes/follows/bookmarks

---

## Security Implementation

### Authentication Flow
1. **Client:** Expo app sends JWT in Authorization header
2. **Middleware:** `middleware.ts` validates JWT using Clerk
3. **API Route:** Extracts `userId` via `auth()` from `@clerk/nextjs/server`
4. **Database:** Uses validated `userId` for all queries

### Security Measures
- ✅ **JWT Verification:** All protected routes validate tokens via Clerk middleware
- ✅ **Input Validation:** Zod schemas on all POST/PATCH endpoints
- ✅ **SQL Injection Protection:** Drizzle ORM parameterized queries
- ✅ **Rate Limiting:** Per-endpoint limits via Upstash Redis
- ✅ **Webhook Verification:** HMAC signatures for Clerk/WooCommerce webhooks
- ✅ **Atomic Operations:** Credit deductions use SQL-level checks
- ✅ **CORS:** Configured for specific Expo app domain

### Common Vulnerabilities to Check
- [ ] Any raw SQL with string interpolation (use parameterized queries)
- [ ] Missing input validation on user-supplied data
- [ ] Exposed sensitive data in API responses (emails, secrets)
- [ ] Race conditions in credit operations
- [ ] Missing rate limits on expensive operations
- [ ] Unverified webhook signatures

---

## API Endpoints Reference

### Authentication
```

POST /api/auth/webhooks/clerk     \# Clerk user sync webhook

```

### User Management
```

GET    /api/user/profile          \# Get authenticated user profile
PATCH  /api/user/profile          \# Update profile (username, bio, avatar)
GET    /api/user/credits          \# Get credit balance
GET    /api/user/[username]       \# Get public user profile by username
GET    /api/user/bookmarks        \# Get user's bookmarked posts
POST   /api/user/following        \# Follow a user
DELETE /api/user/following        \# Unfollow a user
GET    /api/user/following        \# Get following/followers list

```

### AI Generation
```

POST   /api/ai/generate/image     \# Generate image (DALL-E 3)
POST   /api/ai/generate/text      \# Generate text (Gemini/GPT)
GET    /api/ai/history            \# Get generation history (paginated)
GET    /api/ai/status/[jobId]     \# Get single generation status
DELETE /api/ai/status/[jobId]     \# Delete generation
PATCH  /api/ai/status/[jobId]     \# Toggle public/private visibility

```

### Social Features
```

POST   /api/posts/create          \# Create post from AI generation
POST   /api/posts/[postId]/like   \# Like post
DELETE /api/posts/[postId]/like   \# Unlike post
GET    /api/posts/[postId]/comment \# Get comments (paginated)
POST   /api/posts/[postId]/comment \# Add comment
POST   /api/posts/[postId]/bookmark \# Bookmark post
DELETE /api/posts/[postId]/bookmark \# Remove bookmark

```

### Feeds
```

GET /api/feed/home                \# Personalized feed (following)
GET /api/feed/explore             \# Public discover feed (trending/recent)
GET /api/feed/user                \# User's public posts

```

### Payments
```

GET  /api/payments/packages       \# Get credit packages
POST /api/payments/create-checkout \# Generate WooCommerce checkout URL
POST /api/payments/woo/webhook    \# WooCommerce payment webhook

```

### Health
```

GET /api/health                   \# System health check

```

---

## Critical Code Patterns

### 1. Secure API Route Template
```

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRateLimit } from '@/lib/utils/ratelimit';

const inputSchema = z.object({
// Define validation
});

export async function POST(req: Request) {
try {
// 1. Authentication
const { userId } = await auth();
if (!userId) {
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

    // 2. Rate limiting
    const { success } = await apiRateLimit.limit(userId);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    
    // 3. Input validation
    const body = await req.json();
    const validated = inputSchema.parse(body);
    
    // 4. Business logic
    // ...
    
    // 5. Success response
    return NextResponse.json({ success: true });
    } catch (error) {
if (error instanceof z.ZodError) {
return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}
console.error('Error:', error);
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
}

```

### 2. Atomic Credit Operations
```

// ✅ CORRECT - Atomic operation
await db.update(users)
.set({ credits_balance: sql`${users.credits_balance} - ${amount}` })
.where(sql`${users.id} = ${userId} AND ${users.credits_balance} >= ${amount}`)
.returning();

// ❌ WRONG - Race condition possible
const user = await getUser(userId);
if (user.credits >= amount) {
await updateUser(userId, { credits: user.credits - amount });
}

```

### 3. Pagination Pattern
```

const { searchParams } = new URL(req.url);
const page = parseInt(searchParams.get('page') || '1');
const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Max 100
const offset = (page - 1) * limit;

const items = await db.query.table.findMany({
limit,
offset,
orderBy: [desc(table.created_at)],
});

const [{ count }] = await db
.select({ count: sql`count(*)::int` })
.from(table);

return NextResponse.json({
data: items,
pagination: {
page,
limit,
total: count,
totalPages: Math.ceil(count / limit),
hasMore: offset + limit < count,
},
});

```

---

## Environment Variables

### Required Variables (.env.local)
```


# Clerk Authentication

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Neon Database

DATABASE_URL=postgresql://user:pass@ep-xxxxx.neon.tech/legion_ai?sslmode=require

# Upstash Redis

UPSTASH_REDIS_REST_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

# AI Providers

OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_GENERATIVE_AI_API_KEY=xxxxx (optional)

# WordPress/WooCommerce

WORDPRESS_URL=https://legion.yoursite.com
WOOCOMMERCE_WEBHOOK_SECRET=wc_secret_xxxxx

```

### Validation
All environment variables are validated in `lib/env.ts` using Zod schemas. Missing or invalid variables will prevent app startup.

---

## Known Issues & Technical Debt

### Current Limitations
1. **Image Storage:** Using base64 data URLs (should migrate to Cloudinary/S3)
2. **Video Generation:** Not implemented yet (placeholder exists)
3. **Real-time Updates:** Using polling (could upgrade to WebSockets/SSE)
4. **Background Jobs:** Using Redis queue (could upgrade to BullMQ)
5. **Search:** No full-text search implemented
6. **Analytics:** No tracking of user behavior

### Performance Bottlenecks
1. Feed queries can be slow with many followers (needs optimization)
2. No database indexes on frequently queried columns
3. Large base64 images in responses (need CDN)

### Security Improvements Needed
1. Add request size limits for file uploads
2. Implement CSRF protection for state-changing operations
3. Add IP-based rate limiting (currently only user-based)
4. Audit log for admin actions

---

## Testing Guidelines

### What to Test
1. **Authentication:** Ensure all protected routes reject unauthenticated requests
2. **Authorization:** Users can only modify their own data
3. **Input Validation:** All endpoints reject malformed input
4. **Rate Limiting:** Endpoints respect rate limits
5. **Credit System:** Credits deduct correctly, no negative balances
6. **Webhooks:** Signature verification works
7. **Pagination:** Returns correct page counts
8. **Error Handling:** No sensitive data in error messages

### Test Cases to Run
```


# Health check

curl http://localhost:3000/api/health

# Unauthorized access (should fail)

curl http://localhost:3000/api/user/profile

# With valid token (should succeed)

curl -H "Authorization: Bearer <CLERK_JWT>" \
http://localhost:3000/api/user/profile

# Invalid input (should return 400)

curl -X POST http://localhost:3000/api/ai/generate/image \
-H "Authorization: Bearer <CLERK_JWT>" \
-d '{"prompt": "ab"}' \# Too short

```

---

## Common Bugs to Check

### 1. Race Conditions
- [ ] Credit deductions during concurrent AI generation requests
- [ ] Double-like prevention (unique constraint exists, but check handlers)
- [ ] User creation via webhook vs. direct API access

### 2. Memory Leaks
- [ ] Unclosed database connections
- [ ] Large objects in Redis cache
- [ ] Accumulated error logs

### 3. Data Consistency
- [ ] Orphaned posts when AI generation is deleted
- [ ] Stale cache after user actions (cache invalidation)
- [ ] Webhook replay attacks (add idempotency keys)

### 4. Error Handling
- [ ] Unhandled promise rejections
- [ ] Generic error messages exposing internals
- [ ] Missing try-catch blocks

---

## Code Quality Standards

### TypeScript
- ✅ Strict mode enabled
- ✅ No `any` types (use `unknown` if needed)
- ✅ Explicit return types on functions
- ✅ Use `const` over `let` where possible

### Naming Conventions
- **Files:** `kebab-case.ts` (e.g., `feed-cache.ts`)
- **Functions:** `camelCase` (e.g., `deductCredits()`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `CREDIT_COSTS`)
- **Types:** `PascalCase` (e.g., `CreditPackageId`)
- **Database tables:** `snake_case` (e.g., `ai_generations`)

### Code Organization
- Keep API routes under 200 lines (extract logic to `lib/utils`)
- One responsibility per file
- Shared types in separate files
- No circular dependencies

---

## Performance Optimization Checklist

### Database
- [ ] Add indexes on frequently queried columns (`user_id`, `created_at`, `post_id`)
- [ ] Use `SELECT` only needed columns (avoid `SELECT *`)
- [ ] Implement connection pooling (already in `lib/db.ts`)
- [ ] Monitor slow queries via Neon dashboard

### Caching
- [ ] Cache home feed for 5 minutes
- [ ] Cache explore feed for 10 minutes
- [ ] Invalidate cache on user actions (post/like/follow)
- [ ] Set appropriate TTLs

### API Response Size
- [ ] Paginate all list endpoints (max 100 items)
- [ ] Compress large JSON responses
- [ ] Use thumbnail URLs for images (not full resolution)
- [ ] Lazy load comments/likes (don't include in feed)

### Rate Limiting
- [ ] AI generation: 10/hour per user
- [ ] General API: 100/minute per user
- [ ] Auth endpoints: 5/15 minutes
- [ ] Return `X-RateLimit-*` headers

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set in Vercel
- [ ] Database migrations run on Neon
- [ ] Clerk production keys configured
- [ ] WordPress site live with WooCommerce
- [ ] Razorpay production keys added
- [ ] Webhook URLs updated to production

### Post-Deployment
- [ ] Health check returns 200
- [ ] Test user signup flow
- [ ] Test AI generation (both image and text)
- [ ] Test payment flow (small transaction)
- [ ] Monitor Vercel logs for errors
- [ ] Check Neon connection count

---

## AI Agent Instructions

**Your Mission:** Review the Legion AI backend codebase and improve code quality, security, and performance.

### Primary Goals
1. **Security Audit:** Identify and fix any security vulnerabilities
2. **Bug Detection:** Find logic errors, edge cases, and potential crashes
3. **Code Quality:** Improve readability, maintainability, and TypeScript usage
4. **Performance:** Optimize slow queries, add missing indexes, improve caching
5. **Error Handling:** Ensure all errors are caught and logged properly

### Step-by-Step Review Process

#### Phase 1: Security Review
1. Check all API routes for proper authentication (`auth()` called)
2. Verify input validation on all POST/PATCH endpoints (Zod schemas)
3. Ensure no SQL injection risks (use parameterized queries)
4. Validate webhook signature verification
5. Check for exposed sensitive data in responses
6. Verify rate limiting on all endpoints

#### Phase 2: Logic Review
1. Review credit operations for race conditions
2. Check pagination logic (edge cases: page=0, limit>100)
3. Verify unique constraints prevent duplicates
4. Test error paths (what if DB query fails?)
5. Check cache invalidation logic (stale data?)
6. Verify webhook idempotency

#### Phase 3: Code Quality
1. Add missing TypeScript types
2. Remove any `any` types
3. Extract duplicated code into utilities
4. Improve error messages (user-friendly but not exposing internals)
5. Add JSDoc comments to complex functions
6. Ensure consistent naming conventions

#### Phase 4: Performance
1. Add database indexes where needed
2. Optimize N+1 queries (use joins)
3. Reduce SELECT query sizes (only needed columns)
4. Check Redis cache hit rates
5. Identify slow endpoints (profile with logging)

#### Phase 5: Testing
1. Write test cases for critical paths
2. Test edge cases (empty results, invalid IDs)
3. Verify error handling (network failures, DB down)
4. Load test feed endpoints (1000+ posts)

### Output Format

For each issue found, provide:

```


## Issue: [Category] - [Brief Description]

**Severity:** Critical | High | Medium | Low
**File:** `src/path/to/file.ts`
**Line:** 42

**Problem:**
[Explain what's wrong]

**Impact:**
[What could happen because of this issue]

**Solution:**

```typescript
// Fixed code here
```

**Explanation:**
[Why this fix is better]

```

### Focus Areas (Priority Order)

1. **Critical:** Security vulnerabilities, data loss risks
2. **High:** Race conditions, error handling gaps, authentication bypasses
3. **Medium:** Performance bottlenecks, code duplication, missing validations
4. **Low:** Code style, naming inconsistencies, missing comments

### What NOT to Change

- Do not modify the overall architecture (Next.js, Drizzle, etc.)
- Do not change database schema without migration plan
- Do not break existing API contracts (mobile app depends on them)
- Do not remove features (only improve/fix)

### Helpful Commands

```


# Run type checking

npm run type-check

# Check for unused dependencies

npx depcheck

# Format code

npx prettier --write .

# Lint

npx eslint . --fix

```

---

## Contact & Support

**Developer:** Legion AI Team  
**Documentation:** This file  
**Issue Tracker:** GitHub Issues  
**Stack Overflow Tag:** `legion-ai`

---

## Appendix: Quick Reference

### Database Schema Summary
```

users(id, username, email, credits_balance, is_premium, created_at)
ai_generations(id, user_id, prompt, generation_type, result_url, status, credits_cost)
posts(id, user_id, content_id, caption, visibility, created_at)
likes(id, user_id, post_id, created_at) [UNIQUE: user_id, post_id]
comments(id, post_id, user_id, text, created_at)
follows(id, follower_id, following_id, created_at) [UNIQUE: follower_id, following_id]
bookmarks(id, user_id, post_id, created_at) [UNIQUE: user_id, post_id]

```

### Credit Costs
```

Image Generation: 10 credits
Text Generation: 5 credits
Video Generation: 50 credits (not implemented)

```

### Rate Limits
```

AI Generation: 10/hour
General API: 100/minute
Auth Endpoints: 5/15 minutes
Interactions: 30/minute

```

---

**Last Updated:** December 13, 2025  
**Version:** 1.0.0  
**Status:** Production Ready (Pending Deployment)
```


***

This comprehensive guide provides everything an AI agent needs to understand, review, and improve your Legion AI backend. Save this as `AI-AGENT-REVIEW-GUIDE.md` in your project root.

The guide includes:

- ✅ Complete architecture overview
- ✅ Security implementation details
- ✅ All API endpoints documented
- ✅ Common bugs and vulnerabilities to check
- ✅ Code quality standards
- ✅ Step-by-step review instructions
- ✅ Output format for reporting issues


