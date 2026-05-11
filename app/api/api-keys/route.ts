/**
 * Next.js Route Handler for /api/api-keys (GET, POST, DELETE).
 * Validates the GitHub OAuth session, resolves the internal user UUID,
 * and proxies to Express with X-User-Id injected — same pattern as /api/scan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserByGithubId } from '@/server/db/queries';
import { logger } from '@/server/lib/logger';

const EXPRESS_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

/**
 * Resolves the internal DB user UUID from the active GitHub OAuth session.
 * Returns null if the user is not authenticated or the DB lookup fails.
 */
async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.githubId) return null;
  try {
    const user = await getUserByGithubId(session.user.githubId);
    return user?.id ?? null;
  } catch (err) {
    logger.warn({ err }, 'api-keys route: failed to resolve user from session');
    return null;
  }
}

/**
 * Proxies the request to Express with X-User-Id set.
 * Returns 401 if no valid session, 503 if Express is unreachable.
 */
async function proxy(req: NextRequest, method: string, path: string, body?: unknown): Promise<NextResponse> {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    };
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    const expressRes = await fetch(`${EXPRESS_URL}${path}`, fetchOptions);
    const data = await expressRes.json();
    return NextResponse.json(data, { status: expressRes.status });
  } catch (err) {
    logger.error({ err }, 'api-keys route: failed to reach Express backend');
    return NextResponse.json({ error: 'API key service unavailable.' }, { status: 503 });
  }
}

/** Lists all API keys for the authenticated user. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return proxy(req, 'GET', '/api/api-keys');
}

/** Creates a new API key for the authenticated user. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return proxy(req, 'POST', '/api/api-keys', body);
}

/** Deactivates an API key by keyId. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const keyId = req.nextUrl.searchParams.get('keyId');
  if (!keyId) {
    return NextResponse.json({ error: 'Missing keyId query parameter.' }, { status: 400 });
  }
  return proxy(req, 'DELETE', `/api/api-keys/${keyId}`);
}
