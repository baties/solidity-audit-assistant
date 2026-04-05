/**
 * Next.js Route Handler for POST /api/scan.
 * Acts as a thin proxy to the Express scan endpoint, injecting the authenticated
 * user's internal DB UUID via the X-User-Id header when a session exists.
 *
 * Why a Route Handler instead of a direct client→Express call:
 * - Allows server-side session access (auth() is server-only)
 * - Keeps the DB user upsert off the client
 * - Works in both dev (rewrite excluded) and prod (Nginx routes /api/scan here)
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserByGithubId } from '@/server/db/queries';
import { logger } from '@/server/lib/logger';

const EXPRESS_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

/**
 * Forwards a scan submission to Express, optionally attaching the user's DB UUID.
 * Returns the Express response (ScanResult JSON) unchanged.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  let userId: string | null = null;

  if (session?.user) {
    const githubId = session.user.githubId;
    if (githubId) {
      try {
        const user = await getUserByGithubId(githubId);
        userId = user?.id ?? null;
      } catch (err) {
        // Non-fatal: continue scan without user association
        logger.warn({ err }, 'scan route: failed to resolve user from session');
      }
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  try {
    const expressRes = await fetch(`${EXPRESS_URL}/api/scan`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
      // Scans can take up to ~60s — match the Nginx timeout
      signal:  AbortSignal.timeout(120_000),
    });

    const data = await expressRes.json();
    return NextResponse.json(data, { status: expressRes.status });
  } catch (err) {
    logger.error({ err }, 'scan route: failed to reach Express backend');
    return NextResponse.json({ error: 'Scan service unavailable' }, { status: 503 });
  }
}
