/**
 * Scan pipeline orchestrator — coordinates fetcher → analyzer → llm → ScanResult.
 * This is the single entry point for a scan; called by the API route handler.
 * Each pipeline stage is logged with timing for observability.
 */
import { logger } from '../lib/logger';
import { fetchSource } from './fetcher';
import { runStaticAnalysis } from './analyzer';
import { analyzeWithClaude } from './llm';
import type { ScanRequest, ScanResult } from '../../types';

/**
 * Maps a numeric risk score (0–100) to a human-readable risk label.
 * Thresholds align with the LLM system prompt calibration in prompts/system.ts.
 * @param score - Risk score from 0 (safe) to 100 (critical)
 * @returns Risk label string
 */
function scoreToLabel(score: number): ScanResult['riskLabel'] {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 10) return 'low';
  return 'safe';
}

/**
 * Runs the full security scan pipeline for a given target.
 * Coordinates fetcher, static analyzer, and Claude LLM in sequence.
 * @param request - Validated scan request (target, targetType, optional chain)
 * @param scanId  - UUID for this scan run — used for logging and DB tracking
 * @returns Complete ScanResult with risk score, label, findings, and summary
 * @throws Error if any pipeline stage fails (caller logs and persists the error to DB)
 */
export async function runScan(request: ScanRequest, scanId: string): Promise<ScanResult> {
  const pipelineStart = Date.now();
  logger.info({ scanId, target: request.target, targetType: request.targetType }, 'scan pipeline started');

  // Stage 1: fetch source files
  const files = await fetchSource(request);
  logger.info({ scanId, files: files.length }, 'fetcher stage completed');

  // Stage 2: static pattern analysis
  const staticFindings = await runStaticAnalysis(files);
  logger.info({ scanId, staticFindings: staticFindings.length }, 'analyzer stage completed');

  // Stage 3: Claude deep analysis
  const { findings, summary, riskScore } = await analyzeWithClaude(files, staticFindings);
  logger.info({ scanId, findings: findings.length, riskScore }, 'llm stage completed');

  const durationMs = Date.now() - pipelineStart;

  const result: ScanResult = {
    scanId,
    target: request.target,
    riskScore,
    riskLabel: scoreToLabel(riskScore),
    findings,
    summary,
    scannedAt: new Date().toISOString(),
    durationMs,
  };

  logger.info({ scanId, riskScore, riskLabel: result.riskLabel, durationMs }, 'scan pipeline completed');

  return result;
}
