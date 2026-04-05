/**
 * NextAuth.js v5 catch-all route handler.
 * Handles GET /api/auth/signin, /api/auth/callback/github, /api/auth/signout, etc.
 * This Route Handler takes priority over the next.config.mjs rewrite, so these paths
 * are served by Next.js and never proxied to Express.
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
