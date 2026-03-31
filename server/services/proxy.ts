/**
 * Proxy detection service — identifies EIP-1967 (transparent/UUPS) and EIP-1167 (minimal clone)
 * proxy patterns from Solidity source text. Used by the fetcher to determine whether to follow
 * the proxy and fetch the implementation contract's source for a more complete analysis.
 */
import type { SourceFile } from '../../types';

/** Known proxy contract patterns. */
export type ProxyType =
  | 'eip1967-transparent'
  | 'eip1967-uups'
  | 'eip1167-minimal'
  | 'unknown-proxy';

/** Result of proxy pattern detection against Solidity source files. */
export interface ProxyInfo {
  /** True if any proxy pattern was detected in the source. */
  isProxy: boolean;
  /** The specific proxy variant identified, if any. */
  type?: ProxyType;
  /**
   * Short human-readable description of why this is considered a proxy.
   * Included as context in the LLM analysis.
   */
  evidence?: string;
}

/**
 * Source-text patterns for each proxy type.
 * Each entry: { pattern, type, evidence } — pattern is tested against the full file content.
 */
const PROXY_PATTERNS: Array<{ pattern: RegExp; type: ProxyType; evidence: string }> = [
  // EIP-1967 UUPS — function proxiableUUID() is the canonical UUPS indicator (EIP-1822)
  {
    pattern: /\bproxiableUUID\b|\bUUPSUpgradeable\b/i,
    type: 'eip1967-uups',
    evidence: 'UUPSUpgradeable pattern detected (proxiableUUID or UUPSUpgradeable)',
  },
  // EIP-1967 Transparent — TransparentUpgradeableProxy or the canonical slot constant
  {
    pattern: /\bTransparentUpgradeableProxy\b|\b_IMPLEMENTATION_SLOT\b|0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc/i,
    type: 'eip1967-transparent',
    evidence: 'EIP-1967 transparent proxy pattern detected (_IMPLEMENTATION_SLOT or TransparentUpgradeableProxy)',
  },
  // EIP-1167 Minimal Proxy (clone factory pattern — OpenZeppelin Clones / LibClone)
  {
    pattern: /\bClones\b|\bLibClone\b|\bminimalProxy\b|\bclone\s*\(/i,
    type: 'eip1167-minimal',
    evidence: 'EIP-1167 minimal proxy (clone) pattern detected',
  },
  // Generic proxy — fallback for custom proxies that use delegatecall
  {
    pattern: /\bdelegatecall\b/i,
    type: 'unknown-proxy',
    evidence: 'delegatecall usage detected — contract may be a custom proxy',
  },
];

/**
 * Detects proxy patterns in Solidity source files by scanning for known proxy markers.
 * Returns the first (highest-confidence) proxy match found across all files.
 * @param files - Array of Solidity source files to scan
 * @returns ProxyInfo indicating whether a proxy was detected and its type
 */
export function detectProxyFromSource(files: SourceFile[]): ProxyInfo {
  for (const file of files) {
    for (const { pattern, type, evidence } of PROXY_PATTERNS) {
      // Reset lastIndex before each test since we reuse compiled regexes
      pattern.lastIndex = 0;
      if (pattern.test(file.content)) {
        return { isProxy: true, type, evidence };
      }
    }
  }
  return { isProxy: false };
}
