/**
 * Next.js Route Handler for GET /api/history.
 * Returns the authenticated user's scan history (newest first).
 * Requires a valid NextAuth session — returns 401 if not authenticated.
 *
 * Calls the Express scan-history endpoint internally so Express owns the DB query.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserByGithubId } from '@/server/db/queries';
import { logger } from '@/server/lib/logger';

const EXPRESS_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

/**
 * Returns the current user's scan list.
 * @returns JSON { scans: ScanSummary[] } or 401/503 on failure
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const githubId = session.user.githubId;
  if (!githubId) {
    return NextResponse.json({ error: 'Session missing GitHub ID' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const user = await getUserByGithubId(githubId);
    userId = user?.id ?? null;
  } catch (err) {
    logger.error({ err }, 'history route: failed to resolve user from session');
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }

  if (!userId) {
    // User authenticated but not yet in DB — return empty history
    return NextResponse.json({ scans: [] });
  }

  try {
    const res = await fetch(`${EXPRESS_URL}/api/scan-history/${userId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    logger.error({ err }, 'history route: failed to reach Express backend');
    return NextResponse.json({ error: 'History service unavailable' }, { status: 503 });
  }
}
