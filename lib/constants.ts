/**
 * Shared constants used across frontend components and lib utilities.
 * Keep values here so they are updated in one place if they change.
 */

export const SUPPORTED_CHAINS = [
  'ethereum',
  'polygon',
  'arbitrum',
  'optimism',
  'base',
  'bsc',
] as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[number];

/** Chain display labels for the UI chain selector. */
export const CHAIN_LABELS: Record<SupportedChain, string> = {
  ethereum: 'Ethereum',
  polygon:  'Polygon',
  arbitrum: 'Arbitrum One',
  optimism: 'Optimism',
  base:     'Base',
  bsc:      'BNB Chain',
};

/** Base URL for the Express API. Proxied through Next.js rewrites in dev. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export const APP_NAME = 'SolidityGuard AI';
export const APP_TAGLINE = 'AI-powered smart contract security analysis';
