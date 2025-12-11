// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs';

export default clerkMiddleware();

export const config = {
  matcher: ['/api/(.*)'], // Protect all API routes
};
