/**
 * Static pattern analyzer — runs fast regex-based checks on Solidity source before LLM analysis.
 * Phase 1: 5 SWC checks. Phase 2: 12 SWC checks + 2 gas analysis checks.
 * Results are passed as context to Claude to reduce hallucination and anchor findings to real locations.
 */
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import type { SourceFile, VulnerabilityFinding } from '../../types';

/** IDs for all static checks — used by tests to filter findings by type. */
export const STATIC_CHECK_IDS = {
  // Phase 1 — core SWC checks
  REENTRANCY:            'static-reentrancy',
  TX_ORIGIN:             'static-tx-origin',
  UNCHECKED_CALL:        'static-unchecked-call',
  INTEGER_OVERFLOW:      'static-integer-overflow',
  SELFDESTRUCT:          'static-selfdestruct',
  // Phase 2 — extended SWC checks
  ACCESS_CONTROL:        'static-access-control',
  TIMESTAMP_DEPENDENCE:  'static-timestamp-dependence',
  BAD_RANDOMNESS:        'static-bad-randomness',
  FRONT_RUNNING:         'static-front-running',
  DENIAL_OF_SERVICE:     'static-denial-of-service',
  UNINITIALIZED_STORAGE: 'static-uninitialized-storage',
  ARBITRARY_JUMP:        'static-arbitrary-jump',
  // Phase 2 — gas analysis
  GAS_LOOP_LENGTH:       'gas-loop-array-length',
  GAS_STORAGE_WRITE:     'gas-storage-write-loop',
} as const;

/**
 * A single pattern check definition.
 * scope 'line' (default): regex tested against each line individually.
 * scope 'file': regex tested against full file content; line extracted from match index.
 *   Use 'file' for patterns that span multiple lines or require context beyond a single line.
 */
interface CheckDefinition {
  id: string;
  regex: RegExp;
  severity: VulnerabilityFinding['severity'];
  title: string;
  description: string;
  recommendation: string;
  swcId?: string;
  scope?: 'line' | 'file';
}

const CHECKS: CheckDefinition[] = [
  // ─────────────────────────────────────────────
  // Phase 1 checks (5 SWC patterns)
  // ─────────────────────────────────────────────
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
    regex: /pragma\s+solidity\s+[^;]*0\.[5-7]\./gi,
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

  // ─────────────────────────────────────────────
  // Phase 2 checks (7 additional SWC patterns)
  // ─────────────────────────────────────────────
  {
    id: STATIC_CHECK_IDS.ACCESS_CONTROL,
    // Detect high-privilege function signatures that have no access modifier after visibility.
    // In Solidity, modifiers come between visibility and `{`/`returns`:
    //   UNPROTECTED: function mint(address to, uint256 amount) external {
    //   PROTECTED:   function mint(address to, uint256 amount) external onlyOwner {
    // The regex requires `{` or `returns` to follow immediately after visibility (+payable/virtual/override),
    // so any custom modifier between visibility and `{` will prevent a match. (SWC-105)
    regex: /function\s+(?:mint|burn|initialize|upgradeProxy|setOwner|transferOwnership|pause|unpause)\s*\([^)]*\)\s*(?:public|external)(?:\s+payable)?(?:\s+virtual)?(?:\s+override)?(?:\s+returns\s*\([^)]*\))?\s*\{/gi,
    severity: 'high',
    title: 'Unprotected Privileged Function (Missing Access Control)',
    description:
      'A function with a privileged name (`mint`, `burn`, `initialize`, etc.) appears to have no access modifier between its visibility and body. If callable by anyone, this could allow unauthorized minting, burning, or contract takeover (SWC-105).',
    recommendation:
      'Add an access control modifier (e.g. `onlyOwner` from OpenZeppelin Ownable, or a role check via AccessControl). Ensure all privileged functions are protected before deployment.',
    swcId: 'SWC-105',
    scope: 'file',
  },
  {
    id: STATIC_CHECK_IDS.TIMESTAMP_DEPENDENCE,
    // Detect block.timestamp / now usage — miners can manipulate by ~15 seconds (SWC-116)
    // `now` is a deprecated alias for block.timestamp (removed in Solidity 0.7.0)
    regex: /\b(?:block\.timestamp|now)\b/g,
    severity: 'low',
    title: 'Timestamp Dependence (block.timestamp)',
    description:
      '`block.timestamp` (or `now`) can be manipulated by miners within a tolerance of ~15 seconds. Using it for critical logic such as lotteries, vesting schedules, or time-locks exposes the contract to miner front-running (SWC-116).',
    recommendation:
      'Avoid using `block.timestamp` for randomness or highly precise deadlines. For time-locks, a ±15-second tolerance is generally acceptable. For lotteries, use a commit-reveal scheme or Chainlink VRF.',
    swcId: 'SWC-116',
  },
  {
    id: STATIC_CHECK_IDS.BAD_RANDOMNESS,
    // Detect block properties used as randomness sources — all predictable on-chain (SWC-120)
    // blockhash is deterministic, block.difficulty was replaced by PREVRANDAO (still not safe for high-stakes)
    regex: /\b(?:blockhash\s*\(|block\.difficulty\b|block\.prevrandao\b)/gi,
    severity: 'high',
    title: 'Weak Randomness Source (Predictable Block Data)',
    description:
      '`blockhash`, `block.difficulty`, or `block.prevrandao` are being used as a randomness source. These values are known to or influenced by miners/validators and can be predicted or manipulated, making any lottery or random selection insecure (SWC-120).',
    recommendation:
      'Use Chainlink VRF for verifiable, tamper-proof randomness in production. For lower-stakes use cases, consider a commit-reveal scheme where participants commit hashed secrets before the reveal phase.',
    swcId: 'SWC-120',
  },
  {
    id: STATIC_CHECK_IDS.FRONT_RUNNING,
    // Detect the ERC20 approve() function — classic front-running / approval-race vulnerability (SWC-114).
    // Attacker can watch the mempool for an approve() call and sandwich it with transferFrom() calls
    // to drain the old allowance before the new one is set.
    regex: /function\s+approve\s*\(\s*address\s+\w+\s*,\s*uint(?:256)?\s+\w+\s*\)\s*(?:public|external)/gi,
    severity: 'medium',
    title: 'ERC20 Approval Race Condition (Front-Running)',
    description:
      'The `approve(address, uint256)` function is susceptible to the ERC20 approval race condition. An attacker watching the mempool can execute `transferFrom` with the old allowance, then again with the new one, effectively double-spending the approved amount (SWC-114).',
    recommendation:
      'Use `increaseAllowance` / `decreaseAllowance` instead of direct `approve`. Alternatively, require the caller to first set the allowance to 0 before setting a new value, or adopt EIP-2612 permit() for gasless approvals.',
    swcId: 'SWC-114',
    scope: 'file',
  },
  {
    id: STATIC_CHECK_IDS.DENIAL_OF_SERVICE,
    // Detect unbounded loops over array length — if the array grows unboundedly,
    // the gas cost of iterating it can exceed the block gas limit, bricking the function (SWC-113).
    // Pattern: for (uint i = 0; i < someArray.length; i++)
    regex: /for\s*\([^;]*;\s*\w+\s*<\s*\w+\.length\s*;/gi,
    severity: 'medium',
    title: 'Denial of Service via Unbounded Loop',
    description:
      'A `for` loop iterates using `array.length` in the condition. If the array can grow without bound (e.g. any user can push to it), a transaction iterating the full array may exceed the block gas limit, permanently bricking the function (SWC-113).',
    recommendation:
      'Cap the number of elements that can be added to the array, or refactor to a pull-over-push pattern where each user claims their own share individually instead of a single function distributing to all.',
    swcId: 'SWC-113',
  },
  {
    id: STATIC_CHECK_IDS.UNINITIALIZED_STORAGE,
    // Detect Solidity < 0.5.0 — uninitialized local storage pointers were a critical bug class (SWC-109).
    // In 0.0–0.4.x, a local struct/array variable without `memory`/`storage` keyword defaults to a
    // storage pointer at slot 0, silently overwriting state variables.
    // (Note: overflow check covers 0.5–0.7; this check covers 0.0–0.4 with a higher severity.)
    regex: /pragma\s+solidity\s+[^;]*0\.[0-4]\./gi,
    severity: 'high',
    title: 'Uninitialized Storage Pointer Risk (Solidity < 0.5.0)',
    description:
      'This contract targets Solidity < 0.5.0. In these versions, local struct or array variables without an explicit `memory` or `storage` keyword default to a storage pointer at slot 0, which can silently overwrite critical state variables (SWC-109). The code also lacks built-in overflow protection (SWC-101).',
    recommendation:
      'Upgrade to Solidity ^0.8.0 immediately. If a legacy deployment must be maintained, audit every local compound type declaration and add explicit `memory` or `storage` keywords.',
    swcId: 'SWC-109',
  },
  {
    id: STATIC_CHECK_IDS.ARBITRARY_JUMP,
    // Detect function-type local variables — if the function pointer can be overwritten
    // (e.g. via SWC-109 storage collision), an attacker can redirect execution to arbitrary code (SWC-127).
    // Pattern: `function(params) internal varName =`  or  `function(params) internal returns (T) varName =`
    // The optional `returns (...)` group handles the full Solidity function-type syntax.
    regex: /\bfunction\s*\([^)]*\)\s+(?:internal|external|public|private)(?:\s+returns\s*\([^)]*\))?\s+\w+\s*[=;]/gi,
    severity: 'high',
    title: 'Function Type Variable (Arbitrary Jump Risk)',
    description:
      'A function-type local variable is declared. If an attacker can overwrite this variable (e.g. via a storage collision as in SWC-109), they can redirect execution to an arbitrary code location, achieving a full contract takeover (SWC-127).',
    recommendation:
      'Avoid function-type local variables unless strictly necessary. Ensure all function pointer variables are in `memory`, never `storage`. Upgrade to Solidity ^0.8.0 to eliminate storage pointer aliasing.',
    swcId: 'SWC-127',
  },

  // ─────────────────────────────────────────────
  // Phase 2 — Gas analysis checks
  // ─────────────────────────────────────────────
  {
    id: STATIC_CHECK_IDS.GAS_LOOP_LENGTH,
    // Detect array.length read on every loop iteration — costs an extra SLOAD each time.
    // Cache the length before the loop: `uint256 len = arr.length; for (uint i; i < len; i++)`
    regex: /for\s*\([^;]*;\s*\w+\s*<\s*\w+\.length\s*;/gi,
    severity: 'info',
    title: 'Gas: Array Length Read Inside Loop Condition',
    description:
      'The loop condition reads `array.length` on every iteration. For storage arrays this costs an extra SLOAD per iteration; even for memory arrays it re-fetches the length. On large arrays this can add up significantly.',
    recommendation:
      'Cache the array length before the loop: `uint256 len = arr.length; for (uint256 i; i < len; ++i)`. Also prefer `++i` over `i++` to avoid a temporary copy.',
  },
  {
    id: STATIC_CHECK_IDS.GAS_STORAGE_WRITE,
    // Detect storage array .push() calls inside for loops (file-level, dotAll regex).
    // Each .push() to a storage array writes to the blockchain — doing this inside a loop
    // multiplies the SSTORE cost by the loop count.
    regex: /for\s*\([^)]+\)[^{]*\{[^}]{0,800}\.push\s*\(/gis,
    severity: 'info',
    title: 'Gas: Storage Array Push Inside Loop',
    description:
      'A `.push()` call to a storage array was detected inside a `for` loop. Each `push` performs an SSTORE operation (at least 20,000 gas for a new slot), so looping over many elements can make the transaction prohibitively expensive or exceed the block gas limit.',
    recommendation:
      'Batch writes: accumulate values in a memory array during the loop, then write the memory array to storage in a single operation after the loop. Alternatively, rethink the design to use a pull pattern.',
    scope: 'file',
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
      // Always reset lastIndex before each file to prevent cross-file state leakage on `g`/`gi` regexes
      check.regex.lastIndex = 0;

      let firstMatchLine: number | undefined;

      if (check.scope === 'file') {
        // File-level check: match against the entire source text
        const match = check.regex.exec(file.content);
        if (match) {
          // Count newlines before the match position to get 1-indexed line number
          firstMatchLine = file.content.slice(0, match.index).split('\n').length;
        }
      } else {
        // Line-level check (default): test each line individually
        for (let i = 0; i < lines.length; i++) {
          // Reset lastIndex per line — required for `g`/`gi` regexes in .test() mode
          check.regex.lastIndex = 0;
          if (check.regex.test(lines[i])) {
            firstMatchLine = i + 1; // 1-indexed line number
            break;
          }
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
