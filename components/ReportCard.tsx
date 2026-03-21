/**
 * ReportCard — displays the full result of a completed security scan.
 * Renders risk badge, executive summary, severity breakdown, and finding list.
 * Accepts an optional ScanResult prop; renders a loading skeleton when undefined.
 */
'use client';

import { RiskBadge } from './RiskBadge';
import { FindingItem } from './FindingItem';
import type { ScanResult } from '@/types';

interface ReportCardProps {
  /** Completed scan result. Undefined renders a loading skeleton. */
  result?: ScanResult;
}

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

/**
 * Renders a full scan report card with risk badge, summary, and expandable findings.
 * @param result - Optional completed ScanResult; shows skeleton while undefined
 */
export function ReportCard({ result }: ReportCardProps) {
  if (!result) {
    return (
      <div className="space-y-4 animate-pulse" aria-label="Loading scan result">
        <div className="h-8 w-36 rounded-full bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-3/4 rounded bg-white/10" />
        <div className="grid grid-cols-5 gap-2">
          {SEVERITIES.map((s) => (
            <div key={s} className="h-14 rounded-lg bg-white/10" />
          ))}
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  const severityCounts = result.findings.reduce<Record<string, number>>(
    (acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] ?? 0) + 1 }),
    {}
  );

  const durationSec = (result.durationMs / 1000).toFixed(1);
  const scannedDate = new Date(result.scannedAt).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Header: badge + meta */}
      <div className="flex flex-wrap items-center gap-4">
        <RiskBadge riskLabel={result.riskLabel} riskScore={result.riskScore} />
        <span className="text-sm text-white/40">{result.findings.length} findings</span>
        <span className="text-sm text-white/40">·</span>
        <span className="text-sm text-white/40">{durationSec}s</span>
        <span className="text-sm text-white/40">·</span>
        <span className="text-sm text-white/40">{scannedDate}</span>
      </div>

      {/* Target */}
      <p className="font-mono text-xs text-white/30 break-all">{result.target}</p>

      {/* Executive summary */}
      <p className="text-white/80 leading-relaxed">{result.summary}</p>

      {/* Severity breakdown */}
      <div className="grid grid-cols-5 gap-2 text-xs text-center">
        {SEVERITIES.map((sev) => (
          <div key={sev} className="border border-white/10 rounded-lg p-2">
            <div className="font-bold text-lg text-white/90">{severityCounts[sev] ?? 0}</div>
            <div className="text-white/40 capitalize">{sev}</div>
          </div>
        ))}
      </div>

      {/* Findings list */}
      {result.findings.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-white/40 tracking-wider">Findings</h2>
          {result.findings.map((finding, i) => (
            <FindingItem key={finding.id} finding={finding} index={i} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
          <p className="text-green-400 font-semibold">No vulnerabilities found</p>
          <p className="text-white/40 text-sm mt-1">This contract appears safe based on the analysis.</p>
        </div>
      )}
    </div>
  );
}
