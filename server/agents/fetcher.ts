/**
 * Source fetcher agent — retrieves Solidity source files for a given scan target.
 * Delegates to the github service for repo URLs and etherscan service for contract addresses.
 * This is the first stage in the scan pipeline: orchestrator → fetcher → analyzer → llm.
 */
import { logger } from '../lib/logger';
import type { ScanRequest, SourceFile } from '../../types';

/**
 * Fetches Solidity source files for a given scan target.
 * Routes to the correct service based on targetType.
 * @param request - Validated scan request (target, targetType, optional chain)
 * @returns Array of Solidity source files ready for static analysis and LLM review
 * @throws SourceNotVerifiedError if targetType is 'address' and source is not verified
 * @throws NoSolidityFilesError if targetType is 'github' and repo has no .sol files
 * @throws Error on API failure (rate limit, network, auth)
 */
export async function fetchSource(request: ScanRequest): Promise<SourceFile[]> {
  const start = Date.now();
  logger.info({ agent: 'fetcher', target: request.target, targetType: request.targetType }, 'fetch started');

  // Phase 1 implementation:
  // if targetType === 'github': import and call fetchRepoContracts from server/services/github
  // if targetType === 'address': import and call fetchContractSource from server/services/etherscan
  throw new Error('Not implemented — Phase 1');

  // Unreachable — documents logging pattern for Phase 1
  logger.info(
    { agent: 'fetcher', target: request.target, durationMs: Date.now() - start },
    'fetch completed'
  );
}
