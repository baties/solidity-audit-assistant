/**
 * RiskBadge — displays a color-coded risk level label and numeric score.
 * Used in ReportCard and scan history list views.
 * Colors map directly to severity: red=critical, orange=high, yellow=medium, blue=low, green=safe.
 */

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  low:      'bg-blue-500/20 text-blue-400 border-blue-500/40',
  safe:     'bg-green-500/20 text-green-400 border-green-500/40',
};

interface RiskBadgeProps {
  /** Risk label determines the badge color */
  riskLabel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  /** 0–100 numeric risk score displayed alongside the label */
  riskScore: number;
}

/**
 * Displays a severity badge with color coding and numeric score.
 * @param riskLabel - Severity level (critical/high/medium/low/safe)
 * @param riskScore - Numeric score 0–100
 * @returns Colored badge span element
 */
export function RiskBadge({ riskLabel, riskScore }: RiskBadgeProps) {
  const colors = RISK_COLORS[riskLabel] ?? RISK_COLORS.safe;
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold uppercase ${colors}`}
    >
      <span>{riskLabel}</span>
      <span className="opacity-70">{riskScore}/100</span>
    </span>
  );
}
