/**
 * Etherscan API service — fetches verified Solidity source for a contract address.
 * Falls back to Sourcify if Etherscan returns an empty or unverified response.
 * Handles all three Etherscan source formats: plain string, Standard JSON, double-brace JSON.
 */
import { logger } from '../lib/logger';
import type { Chain, SourceFile } from '../../types';

/** Thrown when neither Etherscan nor Sourcify has verified source for the contract. */
export class SourceNotVerifiedError extends Error {
  constructor(address: string, chain: Chain) {
    super(`No verified source found for ${address} on ${chain}`);
    this.name = 'SourceNotVerifiedError';
  }
}

const ETHERSCAN_ENDPOINTS: Record<Chain, string> = {
  ethereum: 'https://api.etherscan.io/api',
  polygon:  'https://api.polygonscan.com/api',
  arbitrum: 'https://api.arbiscan.io/api',
  optimism: 'https://api-optimistic.etherscan.io/api',
  base:     'https://api.basescan.org/api',
  bsc:      'https://api.bscscan.com/api',
};

/**
 * Per-chain API key env var names. Each explorer has its own key system.
 * Falls back to ETHERSCAN_API_KEY if the chain-specific var is not set —
 * allowing users to start with just one key and add per-chain keys as needed.
 */
const CHAIN_API_KEY_ENV: Record<Chain, string> = {
  ethereum: 'ETHERSCAN_API_KEY',
  polygon:  'POLYGONSCAN_API_KEY',
  arbitrum: 'ARBISCAN_API_KEY',
  optimism: 'OPTIMISM_ETHERSCAN_API_KEY',
  base:     'BASESCAN_API_KEY',
  bsc:      'BSCSCAN_API_KEY',
};

/**
 * Resolves the API key for the given chain.
 * Checks the chain-specific env var first, then falls back to ETHERSCAN_API_KEY.
 * @param chain - EVM chain identifier
 * @returns API key string
 * @throws Error if neither a chain-specific key nor the fallback key is set
 */
function resolveApiKey(chain: Chain): string {
  const chainEnvVar = CHAIN_API_KEY_ENV[chain];
  const key = process.env[chainEnvVar] ?? process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error(
      `No API key found for chain "${chain}". ` +
      `Set ${chainEnvVar} or the fallback ETHERSCAN_API_KEY in your .env file.`
    );
  }
  return key;
}

const SOURCIFY_CHAIN_IDS: Record<Chain, number> = {
  ethereum: 1,
  polygon:  137,
  arbitrum: 42161,
  optimism: 10,
  base:     8453,
  bsc:      56,
};

/**
 * Parses the SourceCode field from the Etherscan getsourcecode response.
 * Handles three formats Etherscan returns depending on how the contract was verified:
 *   1. Plain Solidity string — single-file contracts
 *   2. `{{...}}` double-brace Standard JSON Input — multi-file, most common post-2021
 *   3. `{...}` regular JSON — older multi-file format
 * @param sourceCode   - Raw SourceCode string from the API response
 * @param contractName - ContractName field, used as filename for single-file contracts
 * @returns Array of SourceFile objects
 */
function parseEtherscanSource(sourceCode: string, contractName: string): SourceFile[] {
  if (!sourceCode || sourceCode.trim() === '') return [];

  // Format 2: double-brace Standard JSON Input (most common for multi-file Hardhat/Foundry projects)
  if (sourceCode.startsWith('{{')) {
    const json = JSON.parse(sourceCode.slice(1, -1)) as {
      sources: Record<string, { content: string }>;
    };
    return Object.entries(json.sources).map(([filename, v]) => ({
      filename,
      content: v.content,
    }));
  }

  // Format 3: regular JSON with a sources key
  if (sourceCode.startsWith('{')) {
    try {
      const json = JSON.parse(sourceCode) as {
        sources?: Record<string, { content: string }>;
      };
      if (json.sources) {
        return Object.entries(json.sources).map(([filename, v]) => ({
          filename,
          content: v.content,
        }));
      }
    } catch {
      // Fall through to plain string treatment
    }
  }

  // Format 1: plain Solidity source string
  return [{ filename: `${contractName}.sol`, content: sourceCode }];
}

/**
 * Attempts to fetch verified source from Sourcify as a fallback.
 * Sourcify indexes contracts independently of Etherscan verification.
 * @param address - Checksummed EVM contract address
 * @param chainId - Numeric EVM chain ID
 * @returns Array of .sol source files, or empty array if not found
 */
async function fetchFromSourcify(address: string, chainId: number): Promise<SourceFile[]> {
  const url = `https://sourcify.dev/server/files/any/${chainId}/${address}`;
  logger.debug({ service: 'sourcify', url }, 'sourcify fallback attempt');

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json() as { files?: Array<{ name: string; content: string }> };
  if (!data.files) return [];

  return data.files
    .filter((f) => f.name.endsWith('.sol'))
    .map((f) => ({ filename: f.name, content: f.content }));
}

/**
 * Fetches verified Solidity source from Etherscan (chain-aware).
 * Falls back to Sourcify if Etherscan returns unverified or empty source.
 * @param address - Checksummed EVM contract address (0x...)
 * @param chain   - Chain identifier to select the correct Etherscan endpoint
 * @returns Array of source files with filename and content
 * @throws SourceNotVerifiedError if neither Etherscan nor Sourcify has verified source
 */
export async function fetchContractSource(address: string, chain: Chain): Promise<SourceFile[]> {
  const start = Date.now();

  const apiKey = resolveApiKey(chain);
  const baseUrl = ETHERSCAN_ENDPOINTS[chain];
  const url = `${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;

  logger.info({ service: 'etherscan', address, chain }, 'fetching contract source');

  const res = await fetch(url);
  const data = await res.json() as {
    status: string;
    message: string;
    result: Array<{ SourceCode: string; ContractName: string; ABI: string }>;
  };

  if (data.status !== '1' || !data.result?.length) {
    logger.warn({ service: 'etherscan', address, chain, message: data.message }, 'etherscan API error');
    throw new SourceNotVerifiedError(address, chain);
  }

  const { SourceCode, ContractName } = data.result[0];

  if (!SourceCode || SourceCode.trim() === '') {
    logger.info({ service: 'etherscan', address, chain }, 'source empty — trying Sourcify');
    const sourcifyFiles = await fetchFromSourcify(address, SOURCIFY_CHAIN_IDS[chain]);
    if (sourcifyFiles.length === 0) throw new SourceNotVerifiedError(address, chain);
    logger.info({ service: 'sourcify', address, files: sourcifyFiles.length }, 'sourcify fallback succeeded');
    return sourcifyFiles;
  }

  const files = parseEtherscanSource(SourceCode, ContractName);
  logger.info(
    { service: 'etherscan', address, chain, files: files.length, durationMs: Date.now() - start },
    'contract source fetched'
  );
  return files;
}

/**
 * Reads the EIP-1967 implementation storage slot from a proxy contract via Etherscan's
 * `eth_getStorageAt` proxy endpoint. Returns the implementation address if the slot is
 * non-zero, or null if the contract is not an EIP-1967 proxy.
 *
 * EIP-1967 implementation slot:
 *   keccak256("eip1967.proxy.implementation") - 1
 *   = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
 *
 * @param proxyAddress - Checksummed address of the proxy contract
 * @param chain        - Chain to query
 * @returns Implementation contract address (0x-prefixed), or null if not an EIP-1967 proxy
 */
export async function fetchImplementationIfProxy(
  proxyAddress: string,
  chain: Chain,
): Promise<string | null> {
  const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

  try {
    const apiKey = resolveApiKey(chain);
    const baseUrl = ETHERSCAN_ENDPOINTS[chain];
    const url =
      `${baseUrl}?module=proxy&action=eth_getStorageAt` +
      `&address=${proxyAddress}&position=${EIP1967_IMPL_SLOT}&tag=latest&apikey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json() as { result?: string };
    const raw = data.result ?? '';

    // EIP-1967 slot stores the address in the last 20 bytes of a 32-byte word
    // A zero slot means no implementation has been set (not a proxy or uninitialized)
    if (!raw || raw === '0x' || /^0x0+$/.test(raw)) return null;

    // Extract 20-byte address from 32-byte storage value (right-aligned)
    const implAddress = '0x' + raw.slice(-40);
    logger.info(
      { service: 'etherscan', proxy: proxyAddress, implementation: implAddress, chain },
      'eip1967 implementation address found'
    );
    return implAddress;
  } catch (err) {
    logger.warn({ err, service: 'etherscan', proxy: proxyAddress }, 'proxy slot read failed — skipping');
    return null;
  }
}
