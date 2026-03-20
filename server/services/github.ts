/**
 * GitHub API service — fetches .sol files from a public or authenticated repository.
 * Uses Octokit REST with optional GITHUB_TOKEN for higher rate limits.
 * All external API calls are logged with pino.
 */
import { logger } from '../lib/logger';
import type { SourceFile } from '../../types';

/** Thrown when a GitHub repo contains no Solidity source files. */
export class NoSolidityFilesError extends Error {
  constructor(repoUrl: string) {
    super(`No .sol files found in repository: ${repoUrl}`);
    this.name = 'NoSolidityFilesError';
  }
}

/**
 * Fetches all Solidity source files from a GitHub repository.
 * Recursively traverses the repo tree and returns only .sol files.
 * Uses GITHUB_TOKEN if set — increases rate limit from 60 to 5000 req/hr.
 * @param repoUrl - Full GitHub repo URL (e.g. https://github.com/owner/repo)
 * @returns Array of source files with relative filename and content
 * @throws NoSolidityFilesError if the repo has no .sol files
 * @throws Error on GitHub API failure (rate limit, not found, private repo)
 */
export async function fetchRepoContracts(repoUrl: string): Promise<SourceFile[]> {
  const start = Date.now();
  logger.info({ service: 'github', repoUrl }, 'fetching repo contracts');

  // Phase 1 implementation: parse repoUrl, use Octokit getTree recursive, filter .sol, fetch each blob
  throw new Error('Not implemented — Phase 1');

  // Unreachable — documents logging pattern for Phase 1
  logger.info(
    { service: 'github', repoUrl, durationMs: Date.now() - start },
    'repo contracts fetched'
  );
}
