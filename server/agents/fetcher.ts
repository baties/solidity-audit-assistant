/**
 * Source fetcher agent — retrieves Solidity source files for a given scan target.
 * Routes to the GitHub service for repo URLs and Etherscan service for contract addresses.
 * Phase 2: detects EIP-1967 / EIP-1167 proxy contracts and follows them to fetch the
 * implementation source, giving the analyzer a complete picture of the contract system.
 * First stage in the scan pipeline: orchestrator → fetcher → analyzer → llm.
 */
import { logger } from '../lib/logger';
import { fetchRepoContracts } from '../services/github';
import { fetchContractSource, fetchImplementationIfProxy } from '../services/etherscan';
import { detectProxyFromSource } from '../services/proxy';
import type { ScanRequest, SourceFile, Chain } from '../../types';

/**
 * Fetches Solidity source files for a given scan target.
 * For address scans: detects proxy contracts and transparently fetches implementation source.
 * @param request - Validated scan request (target, targetType, optional chain)
 * @returns Array of Solidity source files ready for static analysis and LLM review.
 *          Proxy source files are prefixed to the list; implementation files follow.
 * @throws SourceNotVerifiedError if targetType is 'address' and source is not verified
 * @throws NoSolidityFilesError if targetType is 'github' and repo has no .sol files
 * @throws Error on API failure (rate limit, network error, missing env vars)
 */
export async function fetchSource(request: ScanRequest): Promise<SourceFile[]> {
  const start = Date.now();
  logger.info(
    { agent: 'fetcher', target: request.target, targetType: request.targetType },
    'fetch started'
  );

  let files: SourceFile[];

  if (request.targetType === 'github') {
    files = await fetchRepoContracts(request.target);
  } else {
    // Chain defaults to ethereum if not specified for address scans
    const chain: Chain = request.chain ?? 'ethereum';
    files = await fetchContractSource(request.target, chain);

    // ── Proxy Detection ──────────────────────────────────────────────────
    // Detect if the fetched source is a proxy contract. If so, read the
    // EIP-1967 implementation slot and fetch the implementation source too.
    // This gives the analyzer the full contract system rather than just the proxy shell.
    const proxyInfo = detectProxyFromSource(files);

    if (proxyInfo.isProxy) {
      logger.info(
        { agent: 'fetcher', proxy: request.target, type: proxyInfo.type, evidence: proxyInfo.evidence },
        'proxy contract detected — attempting to fetch implementation'
      );

      const implAddress = await fetchImplementationIfProxy(request.target, chain);

      if (implAddress) {
        try {
          const implFiles = await fetchContractSource(implAddress, chain);
          // Tag implementation files with a path prefix so the analyzer and LLM can distinguish them
          const taggedImplFiles = implFiles.map((f) => ({
            ...f,
            filename: `implementation(${implAddress})/${f.filename}`,
          }));
          // Prepend a synthetic info file so the LLM knows the full proxy/impl relationship
          const proxyNote: SourceFile = {
            filename: '__proxy_info__.txt',
            content:
              `PROXY CONTRACT DETECTED\n` +
              `Proxy type   : ${proxyInfo.type ?? 'unknown'}\n` +
              `Proxy address: ${request.target}\n` +
              `Impl address : ${implAddress}\n` +
              `Evidence     : ${proxyInfo.evidence ?? 'n/a'}\n\n` +
              `The files prefixed with "implementation(${implAddress})/" are the logic contract source.\n` +
              `Audit BOTH the proxy and the implementation for a complete security assessment.`,
          };
          files = [proxyNote, ...files, ...taggedImplFiles];
          logger.info(
            { agent: 'fetcher', implementation: implAddress, implFiles: implFiles.length },
            'implementation source fetched and merged'
          );
        } catch (err) {
          // Implementation source not verified — proceed with proxy source only
          logger.warn(
            { err, agent: 'fetcher', implementation: implAddress },
            'implementation source not available — proceeding with proxy source only'
          );
        }
      } else {
        // Could not read EIP-1967 slot (not a standard EIP-1967, or delegatecall-based proxy)
        // Still useful to note the proxy pattern for the LLM
        const proxyNote: SourceFile = {
          filename: '__proxy_info__.txt',
          content:
            `PROXY PATTERN DETECTED (implementation address could not be resolved)\n` +
            `Proxy type: ${proxyInfo.type ?? 'unknown'}\n` +
            `Evidence  : ${proxyInfo.evidence ?? 'n/a'}\n\n` +
            `The implementation address was not resolvable via EIP-1967 storage slot.\n` +
            `This may be a custom proxy, a minimal clone, or an uninitialized proxy.`,
        };
        files = [proxyNote, ...files];
      }
    }
  }

  logger.info(
    { agent: 'fetcher', target: request.target, files: files.length, durationMs: Date.now() - start },
    'fetch completed'
  );

  return files;
}
