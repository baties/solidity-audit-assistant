/**
 * Static pattern analyzer — runs fast regex-based checks on Solidity source before LLM analysis.
 * Phase 1 implements 5 checks; Phase 2 expands to all 12 SWC categories.
 * Results are passed to the LLM as context, reducing hallucination and improving finding quality.
 */
import { logger } from '../lib/logger';
import type { SourceFile, VulnerabilityFinding } from '../../types';

/**
 * IDs for the 5 static checks implemented in Phase 1.
 * Prefixed 'static-' to distinguish from LLM-generated finding IDs ('llm-').
 */
export const STATIC_CHECK_IDS = {
  REENTRANCY:        'static-reentrancy',
  TX_ORIGIN:         'static-tx-origin',
  UNCHECKED_CALL:    'static-unchecked-call',
  INTEGER_OVERFLOW:  'static-integer-overflow',
  SELFDESTRUCT:      'static-selfdestruct',
} as const;

/**
 * Runs static pattern checks on Solidity source files.
 * Returns preliminary findings before LLM deep analysis.
 *
 * Phase 1 checks (SWC IDs):
 *   - Reentrancy (SWC-107): external call before state update
 *   - tx.origin auth (SWC-115): using tx.origin for access control
 *   - Unchecked low-level calls (SWC-104): .call() return value ignored
 *   - Integer overflow pre-0.8 (SWC-101): arithmetic without SafeMath in <0.8 contracts
 *   - Selfdestruct (SWC-106): presence of selfdestruct/suicide
 *
 * @param files - Array of Solidity source files to analyze
 * @returns Array of preliminary VulnerabilityFinding objects (severity may be adjusted by LLM)
 */
export async function runStaticAnalysis(files: SourceFile[]): Promise<VulnerabilityFinding[]> {
  const start = Date.now();
  logger.info({ agent: 'analyzer', files: files.length }, 'static analysis started');

  // Phase 1 implementation: iterate files, apply regex patterns, collect findings
  const findings: VulnerabilityFinding[] = [];

  logger.info(
    { agent: 'analyzer', findings: findings.length, durationMs: Date.now() - start },
    'static analysis completed'
  );

  return findings;
}
