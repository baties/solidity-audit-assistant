/**
 * ReportCard — displays the full result of a completed security scan.
 * Accepts an optional ScanResult prop; shows a skeleton when undefined (loading state).
 *
 * IMPORTANT (Phase 1): LLM-generated HTML in `finding.description` MUST be sanitized
 * with DOMPurify before rendering via dangerouslySetInnerHTML. Add:
 *   import DOMPurify from 'isomorphic-dompurify'
 *   const safe = DOMPurify.sanitize(finding.description)
 * Never render raw LLM output as HTML without sanitization.
 */
'use client';

import { RiskBadge } from './RiskBadge';
import type { ScanResult } from '@/types';

interface ReportCardProps {
  /** Completed scan result. Undefined renders a loading skeleton. */
  result?: ScanResult;
}

/**
 * Renders a scan report with risk badge, summary, and findings breakdown.
 * @param result - Optional completed ScanResult from the API
 * @returns Report UI or loading skeleton
 */
export function ReportCard({ result }: ReportCardProps) {
  if (!result) {
    // Skeleton placeholder — Phase 1 replaces this with a real loading state
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-32 rounded-full bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="h-24 rounded-lg bg-white/10" />
      </div>
    );
  }

  const severityCounts = result.findings.reduce<Record<string, number>>(
    (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <RiskBadge riskLabel={result.riskLabel} riskScore={result.riskScore} />
        <span className="text-sm text-white/40">{result.findings.length} findings</span>
      </div>

      <p className="text-white/80 leading-relaxed">{result.summary}</p>

      {/* Findings breakdown by severity */}
      <div className="grid grid-cols-5 gap-2 text-xs text-center">
        {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
          <div key={sev} className="border border-white/10 rounded-lg p-2">
            <div className="font-bold text-white/90">{severityCounts[sev] ?? 0}</div>
            <div className="text-white/40 capitalize">{sev}</div>
          </div>
        ))}
      </div>

      {/* Phase 1: render individual findings list here */}
      {/* Remember: sanitize LLM-generated description HTML with DOMPurify before rendering */}
    </div>
  );
}
