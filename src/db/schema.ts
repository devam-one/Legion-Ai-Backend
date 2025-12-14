// db/schema.ts
import { relations } from 'drizzle-orm';
// Removed pgTableCreator and index import, kept 'unique' as it's needed in the callback
import { pgTable, text, uuid, timestamp, integer, boolean, pgEnum, unique, serial } from 'drizzle-orm/pg-core';

// Note: The below code uses the standard Drizzle syntax for composite unique constraints.
// You will see a TypeScript *warning* (not an error) about the pgTable signature being deprecated.
// This is expected and necessary for functionality in your current Drizzle version.

// ===== ENUMS (no changes needed) =====
export const generationTypeEnum = pgEnum('generation_type', ['image', 'video', 'text']);
export const visibilityEnum = pgEnum('visibility', ['public', 'followers', 'private']);

// ===== CORE TABLES =====

// 1. Users (synced from Clerk)
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  avatar_url: text('avatar_url'),
  bio: text('bio'),
  credits_balance: integer('credits_balance').default(100).notNull(),
  is_premium: boolean('is_premium').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// 2. AI Generations (core product)
export const ai_generations = pgTable('ai_generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  prompt: text('prompt').notNull(),
  generation_type: generationTypeEnum('generation_type').notNull(),
  result_url: text('result_url'),
  thumbnail_url: text('thumbnail_url'),
  credits_cost: integer('credits_cost').notNull(),
  status: text('status').default('processing').notNull(),
  is_public: boolean('is_public').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// 3. Posts (social layer)
export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content_id: uuid('content_id').references(() => ai_generations.id, { onDelete: 'cascade' }),
  caption: text('caption'),
  visibility: visibilityEnum('visibility').default('public').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// 4. Social Interactions (Using pgTable with the *required* callback function for unique constraints in your version)

export const likes = pgTable('likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  post_id: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // This is the correct way for your Drizzle version
  uniqueLike: unique('unique_like_constraint').on(table.user_id, table.post_id),
}));


export const follows = pgTable('follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  follower_id: text('follower_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  following_id: text('following_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueFollow: unique('unique_follow_constraint').on(table.follower_id, table.following_id),
}));

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(), // Using UUID consistent with other IDs
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  post_id: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueBookmark: unique('unique_bookmark_constraint').on(table.user_id, table.post_id),
}));

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  post_id: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});


// ===== RELATIONS (These remain unchanged and functional) =====
export const usersRelations = relations(users, ({ many }) => ({
  generations: many(ai_generations),
  posts: many(posts),
  likes: many(likes),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.user_id], references: [users.id] }),
  content: one(ai_generations, { fields: [posts.content_id], references: [ai_generations.id] }),
  likes: many(likes),
  comments: many(comments),
}));

// Add to schema.ts

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending', 'processing', 'completed', 'failed', 'refunded'
]);

export const credit_transactions = pgTable('credit_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  order_id: text('order_id').unique(), // WooCommerce order ID
  session_id: text('session_id').unique(), // Checkout session ID
  idempotency_key: text('idempotency_key').unique(), // Webhook deduplication

  credits_amount: integer('credits_amount').notNull(),
  amount_paid: integer('amount_paid').notNull(), // In paise/cents
  currency: text('currency').default('INR'),

  status: transactionStatusEnum('status').default('pending').notNull(),
  payment_signature: text('payment_signature'), // Webhook signature

  metadata: text('metadata'), // JSON with package details

  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

// Double-ledger for reconciliation
export const credit_balance_snapshots = pgTable('credit_balance_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: text('user_id').references(() => users.id).notNull(),
  transaction_id: uuid('transaction_id').references(() => credit_transactions.id),

  balance_before: integer('balance_before').notNull(),
  balance_after: integer('balance_after').notNull(),
  change_amount: integer('change_amount').notNull(),

  reason: text('reason').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
