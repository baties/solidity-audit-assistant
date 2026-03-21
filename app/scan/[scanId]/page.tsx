/**
 * Scan result page — server component that fetches and displays a completed scan.
 * Calls GET /api/scan/:scanId from the server side, then passes the result to ReportCard.
 * Uses the internal API URL (same container in Docker, localhost in dev).
 */
import { ReportCard } from '@/components/ReportCard';
import type { ScanResult } from '@/types';

/** Shape of the GET /api/scan/:scanId response. */
interface ScanApiResponse {
  id: string;
  target: string;
  status: string;
  riskScore: number | null;
  riskLabel: string | null;
  summary: string | null;
  durationMs: number | null;
  createdAt: string;
  findings: ScanResult['findings'];
}

/**
 * Fetches a scan result from the Express API.
 * @param scanId - UUID of the scan to retrieve
 * @returns ScanResult if completed, or null if not found / not yet complete
 */
async function fetchScanResult(scanId: string): Promise<ScanResult | null> {
  // Use internal API URL for server-side fetch; falls back to localhost for dev
  const apiBase = process.env.INTERNAL_API_URL
    ?? process.env.NEXT_PUBLIC_API_URL
    ?? 'http://localhost:3001';

  const res = await fetch(`${apiBase}/api/scan/${scanId}`, {
    // Do not cache scan results — they are unique and time-sensitive
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data: ScanApiResponse = await res.json();

  if (data.status !== 'completed' || data.riskScore === null || data.riskLabel === null) {
    return null;
  }

  return {
    scanId: data.id,
    target: data.target,
    riskScore: data.riskScore,
    riskLabel: data.riskLabel as ScanResult['riskLabel'],
    summary: data.summary ?? '',
    findings: data.findings,
    scannedAt: data.createdAt,
    durationMs: data.durationMs ?? 0,
  };
}

/**
 * Scan result page — fetches scan server-side and renders the report.
 * @param params.scanId - UUID from the URL path
 */
export default async function ScanResultPage({
  params,
}: {
  params: { scanId: string };
}) {
  const result = await fetchScanResult(params.scanId);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-6 flex items-center gap-3">
        <a
          href="/"
          className="text-sm text-white/40 hover:text-white/70 transition"
        >
          ← New scan
        </a>
        <span className="text-white/20">|</span>
        <span className="text-xs font-mono text-white/30">{params.scanId}</span>
      </div>

      {result === null ? (
        <div className="rounded-lg border border-white/10 p-8 text-center space-y-2">
          <p className="text-white/60">Scan not found or still in progress.</p>
          <p className="text-sm text-white/30">
            If you just submitted a scan, try refreshing in a few seconds.
          </p>
        </div>
      ) : (
        <ReportCard result={result} />
      )}
    </div>
  );
}
