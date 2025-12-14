// middleware.ts (root directory)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes that DON'T need authentication
const isPublicRoute = createRouteMatcher([
  '/api/health',
  '/api/auth/webhooks/clerk', // Clerk will call this to sync users
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
