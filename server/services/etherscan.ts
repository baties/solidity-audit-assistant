/**
 * Etherscan API service — fetches verified Solidity source for a contract address.
 * Falls back to Sourcify if Etherscan returns unverified or missing source.
 * All external API calls are logged with pino.
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
 * Fetches verified Solidity source from Etherscan (chain-aware).
 * Falls back to Sourcify if Etherscan returns unverified source.
 * @param address - Checksummed EVM contract address (0x...)
 * @param chain   - Chain identifier to select the correct Etherscan endpoint
 * @returns Array of source files with filename and content
 * @throws SourceNotVerifiedError if neither service has verified source
 */
export async function fetchContractSource(address: string, chain: Chain): Promise<SourceFile[]> {
  const start = Date.now();
  logger.info({ service: 'etherscan', address, chain }, 'fetching contract source');

  // Phase 1 implementation: call Etherscan getsourcecode, parse multi-file JSON response
  throw new Error('Not implemented — Phase 1');

  // Unreachable — here to document the logging pattern for Phase 1
  logger.info(
    { service: 'etherscan', address, chain, durationMs: Date.now() - start },
    'contract source fetched'
  );
}
