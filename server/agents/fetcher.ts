/**
 * Source fetcher agent — retrieves Solidity source files for a given scan target.
 * Routes to the GitHub service for repo URLs and Etherscan service for contract addresses.
 * First stage in the scan pipeline: orchestrator → fetcher → analyzer → llm.
 */
import { logger } from '../lib/logger';
import { fetchRepoContracts } from '../services/github';
import { fetchContractSource } from '../services/etherscan';
import type { ScanRequest, SourceFile, Chain } from '../../types';

/**
 * Fetches Solidity source files for a given scan target.
 * Routes to the correct service based on targetType.
 * @param request - Validated scan request (target, targetType, optional chain)
 * @returns Array of Solidity source files ready for static analysis and LLM review
 * @throws SourceNotVerifiedError if targetType is 'address' and source is not verified
 * @throws NoSolidityFilesError if targetType is 'github' and repo has no .sol files
 * @throws Error on API failure (rate limit, network error, missing env vars)
 */
export async function fetchSource(request: ScanRequest): Promise<SourceFile[]> {
  const start = Date.now();
  logger.info({ agent: 'fetcher', target: request.target, targetType: request.targetType }, 'fetch started');

  let files: SourceFile[];

  if (request.targetType === 'github') {
    files = await fetchRepoContracts(request.target);
  } else {
    // Chain defaults to ethereum if not specified for address scans
    const chain: Chain = request.chain ?? 'ethereum';
    files = await fetchContractSource(request.target, chain);
  }

  logger.info(
    { agent: 'fetcher', target: request.target, files: files.length, durationMs: Date.now() - start },
    'fetch completed'
  );

  return files;
}
