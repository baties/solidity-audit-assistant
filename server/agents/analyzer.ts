/**
 * Static pattern analyzer — runs fast regex-based checks on Solidity source before LLM analysis.
 * Phase 1 implements 5 SWC-based checks. Results are passed as context to Claude to
 * reduce hallucination and anchor the LLM's attention on real code locations.
 */
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import type { SourceFile, VulnerabilityFinding } from '../../types';

/** IDs for the 5 static checks implemented in Phase 1. */
export const STATIC_CHECK_IDS = {
  REENTRANCY:       'static-reentrancy',
  TX_ORIGIN:        'static-tx-origin',
  UNCHECKED_CALL:   'static-unchecked-call',
  INTEGER_OVERFLOW: 'static-integer-overflow',
  SELFDESTRUCT:     'static-selfdestruct',
} as const;

/** A single pattern check definition. */
interface CheckDefinition {
  id: string;
  regex: RegExp;
  severity: VulnerabilityFinding['severity'];
  title: string;
  description: string;
  recommendation: string;
  swcId: string;
}

const CHECKS: CheckDefinition[] = [
  {
    id: STATIC_CHECK_IDS.REENTRANCY,
    // Detect ETH-value low-level calls — primary reentrancy vector (SWC-107)
    // Matches: addr.call{value:, .call{value:, .call{ value:
    regex: /\.call\s*\{[^}]*value\s*:/gi,
    severity: 'high',
    title: 'Potential Reentrancy (ETH Transfer via Low-Level Call)',
    description:
      'A low-level `.call{value:...}` was detected. If the called contract is malicious or re-enters this contract before state variables are updated, funds could be drained (SWC-107).',
    recommendation:
      'Apply the Checks-Effects-Interactions pattern: update all state variables before making external calls. Alternatively, use OpenZeppelin ReentrancyGuard on any function that transfers ETH.',
    swcId: 'SWC-107',
  },
  {
    id: STATIC_CHECK_IDS.TX_ORIGIN,
    // Detect tx.origin usage — commonly misused for authentication (SWC-115)
    regex: /\btx\.origin\b/g,
    severity: 'high',
    title: 'Use of tx.origin for Authentication',
    description:
      '`tx.origin` refers to the original EOA that initiated the transaction chain, not the immediate caller. If used for access control, a phishing contract can trick the owner into triggering privileged operations (SWC-115).',
    recommendation:
      'Replace `tx.origin` with `msg.sender` for access control checks. `msg.sender` is always the immediate caller and cannot be spoofed.',
    swcId: 'SWC-115',
  },
  {
    id: STATIC_CHECK_IDS.UNCHECKED_CALL,
    // Detect .send() whose return value is commonly ignored (SWC-104)
    // .send() returns bool; unlike .transfer() it does NOT revert on failure
    regex: /\.\s*send\s*\(/g,
    severity: 'medium',
    title: 'Unchecked Return Value of .send()',
    description:
      '`.send()` returns a boolean indicating success or failure but does NOT revert. If the return value is not checked, a failed ETH transfer will silently be ignored (SWC-104).',
    recommendation:
      'Prefer `.transfer()` which reverts on failure, or use `.call{value:...}` and check the returned `bool success`. Never ignore the return value of ETH-sending primitives.',
    swcId: 'SWC-104',
  },
  {
    id: STATIC_CHECK_IDS.INTEGER_OVERFLOW,
    // Detect contracts compiled with Solidity < 0.8.0 which lack built-in overflow checks (SWC-101)
    // Matches pragma like: ^0.7.0, 0.6.12, >=0.5.0, ~0.7.6
    regex: /pragma\s+solidity\s+[^;]*0\.[0-7]\./gi,
    severity: 'medium',
    title: 'Integer Overflow/Underflow Risk (Solidity < 0.8.0)',
    description:
      'This contract targets Solidity < 0.8.0, which does not have built-in arithmetic overflow/underflow protection. Without SafeMath, integer wrap-around can lead to unexpected token minting or balance manipulation (SWC-101).',
    recommendation:
      'Upgrade to Solidity ^0.8.0 where overflow/underflow revert by default. If upgrading is not feasible, import and use OpenZeppelin SafeMath for all arithmetic operations.',
    swcId: 'SWC-101',
  },
  {
    id: STATIC_CHECK_IDS.SELFDESTRUCT,
    // Detect selfdestruct / suicide (deprecated alias) — high-impact operation (SWC-106)
    regex: /\b(?:selfdestruct|suicide)\s*\(/gi,
    severity: 'high',
    title: 'Use of selfdestruct',
    description:
      'The contract contains a `selfdestruct` call. If this function is callable by an attacker (directly or via ownership takeover), they can permanently destroy the contract and steal all ETH. Even in controlled circumstances, selfdestruct is deprecated in EIP-6049 (SWC-106).',
    recommendation:
      'Audit all paths that can reach `selfdestruct`. Ensure it is behind strict access control. Consider removing it entirely and using a pausable/upgradeable pattern instead.',
    swcId: 'SWC-106',
  },
];

/**
 * Runs static pattern checks on Solidity source files.
 * Returns preliminary findings before LLM deep analysis.
 * De-duplicates: reports each check at most once per file.
 * @param files - Array of Solidity source files
 * @returns Array of VulnerabilityFinding objects (may be empty if no patterns matched)
 */
export async function runStaticAnalysis(files: SourceFile[]): Promise<VulnerabilityFinding[]> {
  const start = Date.now();
  logger.info({ agent: 'analyzer', files: files.length }, 'static analysis started');

  const findings: VulnerabilityFinding[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');

    for (const check of CHECKS) {
      // Reset lastIndex so the regex works correctly across multiple files
      check.regex.lastIndex = 0;

      let firstMatchLine: number | undefined;

      for (let i = 0; i < lines.length; i++) {
        check.regex.lastIndex = 0;
        if (check.regex.test(lines[i])) {
          firstMatchLine = i + 1; // 1-indexed line number
          break;
        }
      }

      if (firstMatchLine !== undefined) {
        findings.push({
          id: `${check.id}-${randomUUID().slice(0, 8)}`,
          severity: check.severity,
          title: check.title,
          description: check.description,
          recommendation: check.recommendation,
          swcId: check.swcId,
          filename: file.filename,
          line: firstMatchLine,
        });
      }
    }
  }

  logger.info(
    { agent: 'analyzer', findings: findings.length, durationMs: Date.now() - start },
    'static analysis completed'
  );

  return findings;
}
