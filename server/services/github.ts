/**
 * GitHub API service — fetches .sol files from a public or authenticated repository.
 * Uses Octokit REST with optional GITHUB_TOKEN for higher rate limits (60 → 5000 req/hr).
 * Caps at MAX_SOL_FILES to avoid context window overload on very large repos.
 */
import { Octokit } from '@octokit/rest';
import { logger } from '../lib/logger';
import type { SourceFile } from '../../types';

/** Maximum number of .sol files fetched per repo. Prevents oversized LLM payloads. */
const MAX_SOL_FILES = 50;

/** Thrown when a GitHub repo contains no Solidity source files. */
export class NoSolidityFilesError extends Error {
  constructor(repoUrl: string) {
    super(`No .sol files found in repository: ${repoUrl}`);
    this.name = 'NoSolidityFilesError';
  }
}

/**
 * Parses a GitHub repo URL into owner and repo name.
 * Handles: https://github.com/owner/repo, github.com/owner/repo, and /tree/branch variants.
 * @param url - Full or partial GitHub repository URL
 * @returns { owner, repo }
 * @throws Error if the URL cannot be parsed as a GitHub repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/.\s]+)/);
  if (!match) throw new Error(`Cannot parse GitHub URL: "${url}". Expected format: https://github.com/owner/repo`);
  return { owner: match[1], repo: match[2] };
}

/**
 * Fetches all Solidity source files from a GitHub repository.
 * Recursively traverses the repo tree and returns only .sol files (capped at MAX_SOL_FILES).
 * @param repoUrl - Full GitHub repo URL (e.g. https://github.com/owner/repo)
 * @returns Array of source files with relative path as filename and decoded content
 * @throws NoSolidityFilesError if the repo has no .sol files
 * @throws Error on GitHub API failure (rate limit, repo not found, private without token)
 */
export async function fetchRepoContracts(repoUrl: string): Promise<SourceFile[]> {
  const start = Date.now();
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // Use GITHUB_TOKEN if available — unauthenticated limit is only 60 req/hr
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN ?? undefined,
  });

  logger.info({ service: 'github', owner, repo }, 'fetching repo tree');

  // Get the default branch to find the HEAD tree SHA
  const repoData = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.data.default_branch;

  // Fetch the full recursive tree in one API call (much faster than traversing directories)
  const treeData = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: '1',
  });

  const solFiles = treeData.data.tree
    .filter((item) => item.type === 'blob' && item.path?.endsWith('.sol'))
    .slice(0, MAX_SOL_FILES);

  if (solFiles.length === 0) throw new NoSolidityFilesError(repoUrl);

  logger.info({ service: 'github', owner, repo, solFiles: solFiles.length }, 'found .sol files, fetching content');

  // Fetch each blob's content; decode from base64
  const sourceFiles: SourceFile[] = [];
  for (const item of solFiles) {
    if (!item.sha || !item.path) continue;

    const blob = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha });
    const content = Buffer.from(blob.data.content, 'base64').toString('utf-8');
    sourceFiles.push({ filename: item.path, content });
  }

  logger.info(
    { service: 'github', owner, repo, files: sourceFiles.length, durationMs: Date.now() - start },
    'repo contracts fetched'
  );

  return sourceFiles;
}
