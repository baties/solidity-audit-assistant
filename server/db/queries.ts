/**
 * SQL query helpers for scan lifecycle management.
 * All DB access for the scan pipeline goes through this module.
 * Keeps raw SQL in one place; never write ad-hoc queries in route handlers.
 */
import { query } from './client';
import { logger } from '../lib/logger';
import type { VulnerabilityFinding, ScanStatus } from '../../types';

/** Shape of a scan row joined with its findings, returned by getScanById. */
export interface ScanRecord {
  id: string;
  target: string;
  targetType: 'github' | 'address';
  chain: string | null;
  status: ScanStatus;
  riskScore: number | null;
  riskLabel: string | null;
  summary: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  findings: VulnerabilityFinding[];
}

/**
 * Inserts a new scan row with status 'pending'. Returns the DB-generated UUID.
 * @param target     - GitHub URL or contract address
 * @param targetType - 'github' | 'address'
 * @param chain      - Chain name, undefined for GitHub scans
 * @returns Generated scan UUID
 */
export async function createScan(
  target: string,
  targetType: 'github' | 'address',
  chain?: string
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO scans (target, target_type, chain) VALUES ($1, $2, $3) RETURNING id`,
    [target, targetType, chain ?? null]
  );
  return result.rows[0].id;
}

/**
 * Updates the status field of a scan row.
 * @param scanId - UUID of the scan to update
 * @param status - New status value
 */
export async function updateScanStatus(scanId: string, status: ScanStatus): Promise<void> {
  await query(`UPDATE scans SET status = $1 WHERE id = $2`, [status, scanId]);
}

/**
 * Marks a scan as completed and persists the analysis results.
 * @param scanId    - UUID of the completed scan
 * @param riskScore - 0–100 composite risk score
 * @param riskLabel - Human-readable risk label
 * @param summary   - LLM-generated executive summary
 * @param durationMs - Total pipeline duration in milliseconds
 */
export async function completeScan(
  scanId: string,
  riskScore: number,
  riskLabel: string,
  summary: string,
  durationMs: number
): Promise<void> {
  await query(
    `UPDATE scans
       SET status = 'completed', risk_score = $1, risk_label = $2,
           summary = $3, duration_ms = $4, completed_at = NOW()
     WHERE id = $5`,
    [riskScore, riskLabel, summary, durationMs, scanId]
  );
}

/**
 * Marks a scan as failed and records the error message.
 * @param scanId       - UUID of the failed scan
 * @param errorMessage - Human-readable error description
 */
export async function failScan(scanId: string, errorMessage: string): Promise<void> {
  await query(
    `UPDATE scans SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
    [errorMessage, scanId]
  );
}

/**
 * Bulk-inserts all findings for a scan. Called once after completeScan.
 * @param scanId   - UUID of the parent scan
 * @param findings - Array of vulnerability findings from the pipeline
 */
export async function insertFindings(
  scanId: string,
  findings: VulnerabilityFinding[]
): Promise<void> {
  // Serial inserts are fine at this scale — typically <50 findings per scan
  for (const f of findings) {
    await query(
      `INSERT INTO findings
         (scan_id, severity, title, description, recommendation, filename, line_number, swc_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        scanId,
        f.severity,
        f.title,
        f.description,
        f.recommendation,
        f.filename ?? null,
        f.line ?? null,
        f.swcId ?? null,
      ]
    );
  }
  logger.debug({ scanId, count: findings.length }, 'findings inserted');
}

/** Summary row for scan history listings — no findings included. */
export interface ScanSummary {
  id: string;
  target: string;
  targetType: 'github' | 'address';
  chain: string | null;
  status: ScanStatus;
  riskScore: number | null;
  riskLabel: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Inserts or updates a user row keyed by GitHub provider ID.
 * Called on every sign-in so name/email/avatar stay fresh.
 * @param githubId  - GitHub user ID string from the OAuth provider
 * @param name      - Display name (may be null)
 * @param email     - Primary email (may be null)
 * @param avatarUrl - Profile image URL (may be null)
 * @returns Internal UUID for the user row
 */
export async function upsertUser(
  githubId: string,
  name: string | null,
  email: string | null,
  avatarUrl: string | null
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO users (github_id, name, email, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url
     RETURNING id`,
    [githubId, name, email, avatarUrl]
  );
  return result.rows[0].id;
}

/**
 * Returns a user's internal UUID given their GitHub provider ID.
 * Returns null if the user has not signed in before.
 * @param githubId - GitHub provider user ID
 */
export async function getUserByGithubId(githubId: string): Promise<{ id: string } | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE github_id = $1`,
    [githubId]
  );
  return result.rows[0] ?? null;
}

/**
 * Returns a paginated list of scan summaries for a given user, newest first.
 * Does not include findings — use getScanById for full detail.
 * @param userId - Internal UUID of the user
 * @param limit  - Maximum rows to return (default 20)
 * @param offset - Pagination offset (default 0)
 * @returns Array of ScanSummary rows
 */
export async function getScansByUser(
  userId: string,
  limit = 20,
  offset = 0
): Promise<ScanSummary[]> {
  const result = await query<{
    id: string;
    target: string;
    target_type: string;
    chain: string | null;
    status: string;
    risk_score: number | null;
    risk_label: string | null;
    duration_ms: number | null;
    created_at: string;
    completed_at: string | null;
  }>(
    `SELECT id, target, target_type, chain, status, risk_score, risk_label,
            duration_ms, created_at, completed_at
       FROM scans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows.map((row) => ({
    id: row.id,
    target: row.target,
    targetType: row.target_type as 'github' | 'address',
    chain: row.chain,
    status: row.status as ScanStatus,
    riskScore: row.risk_score,
    riskLabel: row.risk_label,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}

/**
 * Associates an existing scan with a user. Called after the scan pipeline
 * completes when the user was authenticated at submission time.
 * @param scanId - UUID of the scan to update
 * @param userId - Internal UUID of the owning user
 */
export async function assignScanToUser(scanId: string, userId: string): Promise<void> {
  await query(`UPDATE scans SET user_id = $1 WHERE id = $2`, [userId, scanId]);
}

/**
 * Retrieves a scan row and all its findings by scan UUID.
 * Returns null if the scan does not exist.
 * @param scanId - UUID to look up
 * @returns ScanRecord with nested findings array, or null
 */
export async function getScanById(scanId: string): Promise<ScanRecord | null> {
  const scanRes = await query<{
    id: string;
    target: string;
    target_type: string;
    chain: string | null;
    status: string;
    risk_score: number | null;
    risk_label: string | null;
    summary: string | null;
    duration_ms: number | null;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
  }>(`SELECT * FROM scans WHERE id = $1`, [scanId]);

  if (scanRes.rows.length === 0) return null;

  const row = scanRes.rows[0];

  const findingsRes = await query<{
    id: string;
    severity: string;
    title: string;
    description: string;
    recommendation: string;
    filename: string | null;
    line_number: number | null;
    swc_id: string | null;
  }>(`SELECT * FROM findings WHERE scan_id = $1 ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`,
    [scanId]
  );

  const findings: VulnerabilityFinding[] = findingsRes.rows.map((f) => ({
    id: f.id,
    severity: f.severity as VulnerabilityFinding['severity'],
    title: f.title,
    description: f.description,
    recommendation: f.recommendation,
    filename: f.filename ?? undefined,
    line: f.line_number ?? undefined,
    swcId: f.swc_id ?? undefined,
  }));

  return {
    id: row.id,
    target: row.target,
    targetType: row.target_type as 'github' | 'address',
    chain: row.chain,
    status: row.status as ScanStatus,
    riskScore: row.risk_score,
    riskLabel: row.risk_label,
    summary: row.summary,
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    findings,
  };
}
