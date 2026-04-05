/**
 * NextAuth.js v5 configuration — GitHub OAuth provider.
 * Exports { handlers, auth, signIn, signOut } for use across the Next.js app.
 * The `auth()` function is called in server components and Route Handlers to get the session.
 *
 * JWT strategy (no DB adapter) — github_id stored in token.githubId.
 * The actual DB user record is created/updated on first sign-in via the signIn callback.
 * Session type is extended in types/next-auth.d.ts to include the githubId field.
 */
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { upsertUser } from '@/server/db/queries';
import { logger } from '@/server/lib/logger';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    /**
     * Runs after a successful GitHub OAuth sign-in.
     * Upserts the user in our Postgres DB so we have an internal UUID to associate scans.
     * Returns false to deny sign-in on unexpected errors.
     */
    async signIn({ user, account }) {
      if (!account || account.provider !== 'github') return false;

      try {
        await upsertUser(
          String(account.providerAccountId),
          user.name ?? null,
          user.email ?? null,
          user.image ?? null
        );
        return true;
      } catch (err) {
        logger.error({ err }, 'nextauth: failed to upsert user on sign-in');
        return false;
      }
    },

    /**
     * Persists the GitHub provider account ID into the JWT token on first sign-in.
     * The token is re-used on subsequent requests — no DB hit needed.
     */
    async jwt({ token, account }) {
      if (account?.provider === 'github') {
        token['githubId'] = String(account.providerAccountId);
      }
      return token;
    },

    /**
     * Copies githubId from the JWT token onto the client-facing session.
     * session.user.githubId is now typed via types/next-auth.d.ts.
     */
    async session({ session, token }) {
      session.user.githubId = token['githubId'] as string;
      return session;
    },
  },
});
