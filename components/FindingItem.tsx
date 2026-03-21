/**
 * FindingItem — displays a single vulnerability finding in an expandable card.
 * Used inside ReportCard to render the findings list.
 * Descriptions are rendered as plain text — DOMPurify will be added when markdown rendering is introduced.
 */
'use client';

import { useState } from 'react';
import type { VulnerabilityFinding } from '@/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-500/5',
  high:     'border-l-orange-500 bg-orange-500/5',
  medium:   'border-l-yellow-500 bg-yellow-500/5',
  low:      'border-l-blue-500 bg-blue-500/5',
  info:     'border-l-gray-500 bg-gray-500/5',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high:     'bg-orange-500/20 text-orange-400',
  medium:   'bg-yellow-500/20 text-yellow-400',
  low:      'bg-blue-500/20 text-blue-400',
  info:     'bg-gray-500/20 text-gray-400',
};

interface FindingItemProps {
  finding: VulnerabilityFinding;
  index: number;
}

/**
 * Expandable finding card showing severity, title, description, and recommendation.
 * @param finding - The vulnerability finding to display
 * @param index   - Position in the list (used for display numbering)
 */
export function FindingItem({ finding, index }: FindingItemProps) {
  const [open, setOpen] = useState(false);
  const borderColor = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info;
  const badgeColor = SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.info;

  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${borderColor}`}>
      <button
        className="w-full text-left flex items-start gap-3"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded uppercase ${badgeColor}`}>
          {finding.severity}
        </span>
        <span className="flex-1 text-sm font-semibold text-white/90">
          {index + 1}. {finding.title}
        </span>
        {finding.swcId && (
          <span className="shrink-0 text-xs text-white/30">{finding.swcId}</span>
        )}
        <span className="shrink-0 text-white/30 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {(finding.filename || finding.line) && (
            <p className="text-white/40 font-mono text-xs">
              {finding.filename}{finding.line ? `:${finding.line}` : ''}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold uppercase text-white/40 mb-1">Description</p>
            {/* Plain text for now — Phase 2 can add markdown rendering with DOMPurify sanitization */}
            <p className="text-white/70 leading-relaxed">{finding.description}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-white/40 mb-1">Recommendation</p>
            <p className="text-white/70 leading-relaxed">{finding.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
