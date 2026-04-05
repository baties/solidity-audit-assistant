/**
 * Scan History page — /history.
 * Server component: reads the session and fetches the user's past scans directly
 * from Express (via internal URL) after resolving the DB user ID from the GitHub session.
 * Redirects to sign-in if the user is not authenticated.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { RiskBadge } from '@/components/RiskBadge';
import type { ScanSummary } from '@/server/db/queries';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001';

/**
 * Fetches scan summaries for a given internal user UUID directly from Express.
 * @param userId - Internal Postgres UUID for the user
 */
async function fetchHistory(userId: string): Promise<ScanSummary[]> {
  const res = await fetch(`${INTERNAL_API_URL}/api/scan-history/${userId}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json() as { scans: ScanSummary[] };
  return data.scans ?? [];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncateTarget(target: string, max = 50) {
  return target.length > max ? `${target.slice(0, max)}…` : target;
}

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  const githubId = session.user.githubId;

  let scans: ScanSummary[] = [];
  if (githubId) {
    // Resolve internal DB user ID from the GitHub OAuth provider ID
    const { getUserByGithubId } = await import('@/server/db/queries');
    const user = await getUserByGithubId(githubId);
    if (user) {
      scans = await fetchHistory(user.id);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Scan History</h1>
        <p className="text-sm text-white/50">
          Showing scans submitted while signed in as{' '}
          <span className="text-white/80">{session.user.name}</span>
        </p>
      </div>

      {scans.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-8 text-center text-white/40">
          No scans yet.{' '}
          <a href="/" className="text-[var(--brand-green)] hover:underline">
            Run your first scan
          </a>
        </div>
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => (
            <li key={scan.id}>
              <a
                href={`/scan/${scan.id}`}
                className="block border border-white/10 rounded-lg p-4 hover:border-white/25 transition space-y-2"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-mono text-white/80 truncate">
                    {truncateTarget(scan.target)}
                  </span>
                  {scan.riskLabel && scan.riskScore !== null ? (
                    <RiskBadge
                      riskLabel={scan.riskLabel as 'critical' | 'high' | 'medium' | 'low' | 'safe'}
                      riskScore={scan.riskScore}
                    />
                  ) : (
                    <span className="text-xs text-white/30 uppercase">{scan.status}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span>
                    {scan.targetType === 'address' ? `Chain: ${scan.chain ?? 'ethereum'}` : 'GitHub'}
                  </span>
                  <span>{formatDate(scan.createdAt)}</span>
                  {scan.durationMs != null && (
                    <span>{(scan.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
