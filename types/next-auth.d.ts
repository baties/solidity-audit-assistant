/**
 * NextAuth.js v5 session type augmentation.
 * Adds the githubId field to the Session user object so it is typed throughout the app.
 * The value is populated in auth.ts session callback from the JWT token.
 */
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /** GitHub OAuth provider account ID — used to look up the internal DB user UUID. */
      githubId: string;
    } & DefaultSession['user'];
  }
}
