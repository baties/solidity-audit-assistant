/**
 * Scan pipeline orchestrator — coordinates fetcher → analyzer → llm → ScanResult.
 * Single entry point for a scan job; called by the POST /api/scan route handler.
 * Each stage is timed and logged with the scanId for end-to-end traceability.
 */
import { logger } from '../lib/logger';
import { fetchSource } from './fetcher';
import { runStaticAnalysis } from './analyzer';
import { analyzeWithClaude } from './llm';
import type { ScanRequest, ScanResult } from '../../types';

/**
 * Maps a 0–100 risk score to a human-readable risk label.
 * Thresholds match the calibration in prompts/system.ts SYSTEM_PROMPT.
 * @param score - Numeric risk score from Claude
 * @returns Corresponding risk label
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
 * Stages: fetch source → static analysis → Claude LLM → assemble ScanResult.
 * @param request - Validated scan request (target, targetType, optional chain)
 * @param scanId  - UUID assigned by the API layer for logging and DB tracking
 * @returns Complete ScanResult with risk score, label, findings, and summary
 * @throws Error if any pipeline stage fails (caller handles DB error persistence)
 */
export async function runScan(request: ScanRequest, scanId: string): Promise<ScanResult> {
  const pipelineStart = Date.now();
  logger.info({ scanId, target: request.target, targetType: request.targetType }, 'scan pipeline started');

  // Stage 1: fetch source files from GitHub or Etherscan
  const stageStart1 = Date.now();
  const files = await fetchSource(request);
  logger.info({ scanId, files: files.length, stageMs: Date.now() - stageStart1 }, 'stage:fetcher done');

  // Stage 2: fast static pattern checks — results passed to LLM as context
  const stageStart2 = Date.now();
  const staticFindings = await runStaticAnalysis(files);
  logger.info({ scanId, staticFindings: staticFindings.length, stageMs: Date.now() - stageStart2 }, 'stage:analyzer done');

  // Stage 3: deep Claude analysis — returns enriched findings + score + summary
  const stageStart3 = Date.now();
  const { findings, summary, riskScore } = await analyzeWithClaude(files, staticFindings);
  logger.info({ scanId, findings: findings.length, riskScore, stageMs: Date.now() - stageStart3 }, 'stage:llm done');

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

  logger.info(
    { scanId, riskScore, riskLabel: result.riskLabel, findings: findings.length, durationMs },
    'scan pipeline completed'
  );

  return result;
}
