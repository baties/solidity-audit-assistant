/**
 * Shared TypeScript interfaces for SolidityGuard AI.
 * Used by both the Express backend and Next.js frontend.
 * All API request/response shapes must match these types.
 */

/** Supported EVM-compatible chains for contract source fetching. */
export type Chain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'bsc';

/**
 * A single Solidity source file retrieved from GitHub or Etherscan.
 * @property filename - Relative path as it appears in the repo or verified source
 * @property content  - Raw Solidity source text
 */
export interface SourceFile {
  filename: string;
  content: string;
}

/**
 * A single security vulnerability finding produced by static analysis or LLM.
 * Severity follows OWASP/SWC conventions: critical = funds at immediate risk.
 */
export interface VulnerabilityFinding {
  /** Unique identifier — prefixed 'static-' for pattern checks, 'llm-' for Claude findings */
  id: string;
  /** Risk severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Short title (e.g. "Reentrancy Vulnerability") */
  title: string;
  /** Full description of the vulnerability and its impact */
  description: string;
  /** Source line number where the issue was found, if identifiable */
  line?: number;
  /** Source filename where the issue was found, if identifiable */
  filename?: string;
  /** Specific, actionable remediation advice */
  recommendation: string;
  /** SWC registry ID if applicable (e.g. "SWC-107") */
  swcId?: string;
}

/**
 * Incoming scan request — validated with Zod on both client and server.
 * @property target     - GitHub repo URL or checksummed EVM contract address
 * @property targetType - Determines which fetcher to use
 * @property chain      - Required when targetType is 'address'; ignored for GitHub
 */
export interface ScanRequest {
  target: string;
  targetType: 'github' | 'address';
  chain?: Chain;
}

/**
 * Complete result of a security scan, returned by the orchestrator.
 * Stored in the `scans` + `findings` DB tables after completion.
 */
export interface ScanResult {
  /** UUID assigned at scan creation time */
  scanId: string;
  /** Original scan target (URL or address) */
  target: string;
  /** 0–100 composite risk score (100 = most dangerous) */
  riskScore: number;
  /** Human-readable risk label derived from riskScore */
  riskLabel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  /** All findings sorted by severity (critical first) */
  findings: VulnerabilityFinding[];
  /** LLM-generated executive summary of the audit */
  summary: string;
  /** ISO-8601 timestamp of when the scan completed */
  scannedAt: string;
  /** Wall-clock duration of the full pipeline in milliseconds */
  durationMs: number;
}

/** Lifecycle state of a scan job tracked in the database. */
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';
